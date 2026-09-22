/*
  =============================================================================
  Indrayani Watch — Real-Time IoT River Water Quality Monitoring Node
  Target Hardware: ESP32 DevKit V1
  File: backend/hardware/esp32_client.ino
  =============================================================================

  NETWORK & HOST CONFIGURATION NOTE:
  -----------------------------------------------------------------------------
  IMPORTANT: Set BACKEND_URL below to your PC's local LAN IP address 
  (e.g., "http://192.168.1.50:4000/api/ingest") if testing locally on the same Wi-Fi, 
  or your public production URL (e.g., "https://indrayani-api.onrender.com/api/ingest") 
  once deployed to Render / Railway.
  
  DO NOT USE "localhost" or "127.0.0.1" — "localhost" on an ESP32 resolves to the 
  ESP32 microcontroller itself and will fail with connection refused!
  =============================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <SD.h>
#include <Wire.h>
#include <RTClib.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <time.h>

// =============================================================================
// 1. Wi-Fi & Backend Credentials
// =============================================================================
const char* WIFI_SSID     = "Pass";
const char* WIFI_PASSWORD = "Password@00";

// NOTE: Replace with your PC's LAN IP (e.g. http://192.168.1.100:4000) or deployed public URL
const char* BACKEND_URL   = "http://10.105.51.191:4000/api/health";

// Device and Node Identity
const char* DEVICE_ID     = "ESP32-S4";                  // e.g. "ESP32-S1" .. "ESP32-S6"
const char* STATION_ID    = "S4";                        // Matches backend station ("S1".."S6")
const char* API_KEY       = "indrayani-key-s4";          // Device API key verified against backend

// Sampling & Telemetry Interval
const unsigned long SAMPLING_INTERVAL_MS = 30000;       // Sample every 30 seconds
unsigned long lastSampleTime = 0;

// =============================================================================
// 2. Hardware Pin Assignments (ESP32 ADC1 / GPIO)
// =============================================================================
// Note: ESP32 ADC1 pins are safe to use while Wi-Fi is active (ADC2 is restricted)
const int PIN_PH          = 36; // ADC1_CH0 (VP) - Analog pH Sensor
const int PIN_DO          = 39; // ADC1_CH3 (VN) - Galvanic Dissolved Oxygen Sensor
const int PIN_TURBIDITY   = 34; // ADC1_CH6      - Optical Turbidity Sensor
const int PIN_TDS         = 35; // ADC1_CH7      - Analog Electrical Conductivity / TDS Sensor
const int PIN_ONE_WIRE    = 4;  // GPIO 4        - DS18B20 Waterproof Temperature Bus
const int PIN_SD_CS       = 5;  // GPIO 5        - MicroSD SPI Chip Select

// MicroSD buffer file name for offline logging during Wi-Fi outages
const char* SD_BUFFER_FILE = "/telemetry_buffer.jsonl";

// Sensor Bus Instances
OneWire oneWire(PIN_ONE_WIRE);
DallasTemperature tempSensor(&oneWire);
RTC_DS3231 rtc;
bool rtcFound = false;
bool sdAvailable = false;

// =============================================================================
// 3. Sensor Calibration Equations & Constants
// =============================================================================

// CALIBRATE: pH Sensor Calibration
// Standard 2-point calibration with buffer solutions (pH 4.01 and pH 7.00 / 9.18)
// Formula: pH = PH_NEUTRAL_VOLTAGE + ((voltage - PH_NEUTRAL_VOLTAGE) * PH_SLOPE)
const float PH_NEUTRAL_VOLTAGE = 1.50; // Voltage at neutral pH 7.00
const float PH_SLOPE           = -3.5; // Slope (negative mV per pH unit)

float readCalibratedPH(float voltage, float temperature) {
  // CALIBRATE: Insert your measured laboratory calibration curve here
  float ph = 7.0 + ((PH_NEUTRAL_VOLTAGE - voltage) * PH_SLOPE);
  // Temperature compensation (+0.03 pH per 10°C deviation from 25°C)
  ph += (25.0 - temperature) * 0.003;
  return constrain(ph, 0.0, 14.0);
}

// CALIBRATE: Galvanic Dissolved Oxygen (DO) Sensor Calibration
// Calibrate in 100% air saturation (water-saturated air chamber)
const float DO_V_AIR = 1.65;           // Voltage reading in 100% air saturation at 25°C
const float DO_SATURATION_25C = 8.26;  // mg/L saturation of oxygen in water at 25°C and 1 atm

float readCalibratedDO(float voltage, float temperature) {
  // CALIBRATE: Temperature-compensated Dissolved Oxygen formula
  if (DO_V_AIR <= 0.0) return 6.0;
  float doMgL = (voltage / DO_V_AIR) * DO_SATURATION_25C;
  // Solubility adjustment factor across temperature
  float tempFactor = 1.0 - ((temperature - 25.0) * 0.015);
  doMgL *= tempFactor;
  return constrain(doMgL, 0.0, 20.0);
}

// CALIBRATE: Turbidity Sensor Calibration (DFRobot Optical Turbidity)
// Pure clear water voltage is typically ~4.1V - 4.5V (0 NTU).
// Voltage drops as water becomes turbid and light scattering increases.
const float TURBIDITY_CLEAR_VOLTAGE = 3.20; // 0 NTU voltage (ESP32 3.3V ADC with divider)

float readCalibratedTurbidity(float voltage) {
  // CALIBRATE: Polynomial response curve from nephelometric calibration
  // Characteristic equation: NTU = -1120.4 * (V^2) + 5742.3 * V - 4352.9
  if (voltage >= TURBIDITY_CLEAR_VOLTAGE) return 0.5; // Pristine clear
  float ntu = -1120.4 * (voltage * voltage) + 5742.3 * voltage - 4352.9;
  if (ntu < 0) ntu = 0.0;
  return constrain(ntu, 0.0, 500.0);
}

// CALIBRATE: TDS & Electrical Conductivity Calibration
// Measures ionic mobility. Temperature coefficient standard: 2.0% per °C from 25°C.
const float TDS_FACTOR = 0.64; // Conversion factor from EC (µS/cm) to TDS (ppm)

void readCalibratedTDSandEC(float voltage, float temperature, float &tdsPpm, float &ecUscm) {
  // CALIBRATE: Insert laboratory cell constant K and temperature compensation factor
  float compensationCoefficient = 1.0 + 0.02 * (temperature - 25.0);
  float compensatedVoltage = voltage / compensationCoefficient;

  // Empirical cubic conversion to TDS (DFRobot analog gravity TDS curve):
  float tds = (133.42 * pow(compensatedVoltage, 3) - 255.86 * pow(compensatedVoltage, 2) + 857.39 * compensatedVoltage) * 0.5;
  if (tds < 0) tds = 0.0;
  tdsPpm = constrain(tds, 0.0, 2000.0);
  ecUscm = (TDS_FACTOR > 0) ? (tdsPpm / TDS_FACTOR) : (tdsPpm * 1.56);
}

// =============================================================================
// 4. ADC Multi-Sampling & Oversampling (Noise Reduction)
// =============================================================================
float readAdcVoltage(int pin) {
  const int SAMPLES = 32;
  long sum = 0;
  for (int i = 0; i < SAMPLES; i++) {
    sum += analogRead(pin);
    delayMicroseconds(100);
  }
  float avgRaw = (float)sum / SAMPLES;
  // ESP32 12-bit ADC (0 - 4095) with 3.3V full-scale reference
  return (avgRaw / 4095.0) * 3.3;
}

// =============================================================================
// 5. ISO-8601 Timestamp Generation
// =============================================================================
String getISOTimestamp() {
  if (rtcFound) {
    DateTime now = rtc.now();
    char buf[30];
    snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02dZ",
             now.year(), now.month(), now.day(),
             now.hour(), now.minute(), now.second());
    return String(buf);
  }

  // Fallback: NTP or internal millis formatted string
  time_t nowSec;
  time(&nowSec);
  if (nowSec > 1672531200) { // Year > 2023
    struct tm timeinfo;
    gmtime_r(&nowSec, &timeinfo);
    char buf[30];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
    return String(buf);
  }

  return "2026-09-19T10:00:00Z";
}

// =============================================================================
// 6. MicroSD Buffering (Offline Storage)
// =============================================================================
void appendToSDBuffer(const String &jsonLine) {
  if (!sdAvailable) return;
  File file = SD.open(SD_BUFFER_FILE, FILE_APPEND);
  if (file) {
    file.println(jsonLine);
    file.close();
    Serial.println(F("[SD] Reading logged to offline buffer."));
  } else {
    Serial.println(F("[SD] Error opening buffer file for writing."));
  }
}

// Flush buffered readings to backend via batch upload when Wi-Fi is restored
void flushSDBuffer() {
  if (!sdAvailable || WiFi.status() != WL_CONNECTED) return;
  if (!SD.exists(SD_BUFFER_FILE)) return;

  File file = SD.open(SD_BUFFER_FILE, FILE_READ);
  if (!file) return;

  size_t fileSize = file.size();
  if (fileSize == 0) {
    file.close();
    SD.remove(SD_BUFFER_FILE);
    return;
  }

  Serial.println(F("[SD] Wi-Fi online: Transmitting offline buffered readings as batch..."));

  // Read lines and construct a batch JSON array
  DynamicJsonDocument doc(8192);
  JsonArray array = doc.to<JsonArray>();

  int count = 0;
  while (file.available() && count < 25) { // Cap at 25 readings per batch request
    String line = file.readStringUntil('\n');
    line.trim();
    if (line.length() > 10) {
      StaticJsonDocument<512> itemDoc;
      DeserializationError err = deserializeJson(itemDoc, line);
      if (!err) {
        array.add(itemDoc.as<JsonObject>());
        count++;
      }
    }
  }
  file.close();

  if (count == 0) {
    SD.remove(SD_BUFFER_FILE);
    return;
  }

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", API_KEY);

  int httpCode = http.POST(payload);
  if (httpCode == 200 || httpCode == 201) {
    Serial.printf("[HTTP] Batch sync successful! Flushed %d readings.\n", count);
    SD.remove(SD_BUFFER_FILE); // Clear buffer on success
  } else {
    Serial.printf("[HTTP] Batch sync returned code %d. Buffer retained.\n", httpCode);
  }
  http.end();
}

// =============================================================================
// 7. Live Telemetry Transmission
// =============================================================================
bool postTelemetry(const String &jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", API_KEY);
  http.setTimeout(5000);

  int httpResponseCode = http.POST(jsonPayload);
  bool success = (httpResponseCode == 200 || httpResponseCode == 201);

  if (success) {
    Serial.printf("[HTTP] Telemetry POST successful (HTTP %d)\n", httpResponseCode);
  } else {
    Serial.printf("[HTTP] Telemetry POST failed (HTTP %d). Buffering to SD.\n", httpResponseCode);
  }

  http.end();
  return success;
}

// =============================================================================
// Setup & Initialization
// =============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("\n======================================================="));
  Serial.printf("Indrayani Watch IoT Sentinel Node [%s / %s]\n", DEVICE_ID, STATION_ID);
  Serial.println(F("======================================================="));

  // Initialize ADC resolution to 12-bit
  analogReadResolution(12);

  // Initialize Temperature Sensor
  tempSensor.begin();

  // Initialize I2C RTC (DS3231)
  Wire.begin();
  if (rtc.begin()) {
    rtcFound = true;
    Serial.println(F("[RTC] DS3231 real-time clock initialized successfully."));
  } else {
    Serial.println(F("[RTC] Warning: DS3231 RTC not detected. Using NTP fallback."));
  }

  // Initialize MicroSD Card
  if (SD.begin(PIN_SD_CS)) {
    sdAvailable = true;
    Serial.println(F("[SD] MicroSD Card storage mounted. Offline buffer ready."));
  } else {
    Serial.println(F("[SD] Warning: MicroSD Card initialization failed."));
  }

  // Connect to Wi-Fi
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(F("\n[WiFi] Connected!"));
    Serial.printf("[WiFi] IP Address: %s\n", WiFi.localIP().toString().c_str());
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    // Attempt to flush any previously stored offline buffer
    flushSDBuffer();
  } else {
    Serial.println(F("\n[WiFi] Connection timeout. Operating in autonomous offline SD logging mode."));
  }
}

// =============================================================================
// Main Telemetry Loop
// =============================================================================
void loop() {
  unsigned long now = millis();

  // Check if Wi-Fi reconnected -> flush offline buffer
  if (WiFi.status() == WL_CONNECTED) {
    flushSDBuffer();
  }

  // Sample sensors at defined interval
  if (now - lastSampleTime >= SAMPLING_INTERVAL_MS) {
    lastSampleTime = now;

    // 1. Read DS18B20 Water Temperature
    tempSensor.requestTemperatures();
    float waterTemp = tempSensor.getTempCByIndex(0);
    if (waterTemp < -10.0 || waterTemp > 70.0) {
      waterTemp = 25.0; // Sensible default if probe disconnected
    }

    // 2. Read ADC Voltages
    float vPh = readAdcVoltage(PIN_PH);
    float vDo = readAdcVoltage(PIN_DO);
    float vTurb = readAdcVoltage(PIN_TURBIDITY);
    float vTds = readAdcVoltage(PIN_TDS);

    // 3. Apply Calibration Equations
    float ph = readCalibratedPH(vPh, waterTemp);
    float dOxygen = readCalibratedDO(vDo, waterTemp);
    float turbidity = readCalibratedTurbidity(vTurb);
    float tds = 0.0, ec = 0.0;
    readCalibratedTDSandEC(vTds, waterTemp, tds, ec);

    // 4. Construct JSON Reading Payload
    String timestamp = getISOTimestamp();

    StaticJsonDocument<512> doc;
    doc["device_id"]    = DEVICE_ID;
    doc["station_id"]   = STATION_ID;
    doc["api_key"]      = API_KEY;
    doc["timestamp"]    = timestamp;
    doc["ph"]           = serialized(String(ph, 2));
    doc["do"]           = serialized(String(dOxygen, 2));
    doc["turbidity"]    = serialized(String(turbidity, 1));
    doc["tds"]          = (int)round(tds);
    doc["conductivity"] = (int)round(ec);
    doc["temperature"]  = serialized(String(waterTemp, 1));

    String jsonString;
    serializeJson(doc, jsonString);

    Serial.printf("\n[Telemetry] Time: %s | pH: %.2f | DO: %.2f mg/L | Turb: %.1f NTU | TDS: %d ppm | Temp: %.1f C\n",
                  timestamp.c_str(), ph, dOxygen, turbidity, (int)tds, waterTemp);

    // 5. Transmit or Buffer
    if (WiFi.status() == WL_CONNECTED) {
      bool sent = postTelemetry(jsonString);
      if (!sent) {
        appendToSDBuffer(jsonString);
      }
    } else {
      appendToSDBuffer(jsonString);
    }
  }

  delay(100);
}
