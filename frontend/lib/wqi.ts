/**
 * Water Quality Index (WQI) calculation & BIS IS 10500:2012 Standard Limits
 * 
 * Implements a weighted-sum Water Quality Index (NSF / CCME style)
 * integrating pH, Dissolved Oxygen (DO), Turbidity, Total Dissolved Solids (TDS),
 * and Water Temperature.
 * 
 * Score Range: 0 – 100
 * Classification:
 *   - >= 80 : 'good'
 *   - 60–79 : 'moderate'
 *   - 40–59 : 'poor'
 *   - < 40  : 'very-poor'
 */

export type WQIStatus = 'good' | 'moderate' | 'poor' | 'very-poor';

export interface WQIInput {
  ph: number;          // 0 - 14
  do: number;          // mg/L (Dissolved Oxygen)
  turbidity: number;   // NTU
  tds: number;         // ppm (mg/L)
  temperature: number; // °C
}

export interface WQIBreakdown {
  wqi: number;
  status: WQIStatus;
  subIndices: {
    ph: number;
    do: number;
    turbidity: number;
    tds: number;
    temperature: number;
  };
  weights: {
    ph: number;
    do: number;
    turbidity: number;
    tds: number;
    temperature: number;
  };
}

/**
 * Parameter weights for weighted-sum index
 * DO (0.30) has highest weight due to direct link to ecosystem survival & hypoxia.
 * pH (0.20) and Turbidity (0.20) carry significant weight for chemical & physical clarity.
 * TDS (0.15) and Temperature (0.15) complete the CCME/NSF profile.
 * Total sum = 1.00
 */
export const WQI_WEIGHTS = {
  do: 0.30,
  ph: 0.20,
  turbidity: 0.20,
  tds: 0.15,
  temperature: 0.15,
} as const;

/**
 * Sub-index calculation for pH (ideal ~ 7.0 - 7.5; standard acceptable 6.5 - 8.5)
 */
export function getSubIndexPH(ph: number): number {
  if (ph < 0 || ph > 14) return 0;
  // Quadratic/exponential penalty as pH deviates from optimal neutral 7.2
  const deviation = Math.abs(ph - 7.2);
  if (deviation <= 0.3) return 100;
  const score = 100 - 36 * Math.pow(deviation, 1.4);
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

/**
 * Sub-index calculation for Dissolved Oxygen (DO in mg/L)
 * Aquatic life thrives at >= 7 mg/L; drops into hypoxia below 4 mg/L; critical septic < 2 mg/L.
 */
export function getSubIndexDO(dOxygen: number): number {
  if (dOxygen <= 0) return 0;
  if (dOxygen >= 7.5) return 100;
  if (dOxygen >= 5.0) {
    // 5.0 - 7.5 mg/L -> 70 to 100
    return Math.round((70 + ((dOxygen - 5.0) / 2.5) * 30) * 10) / 10;
  }
  if (dOxygen >= 3.0) {
    // 3.0 - 5.0 mg/L -> 35 to 70
    return Math.round((35 + ((dOxygen - 3.0) / 2.0) * 35) * 10) / 10;
  }
  if (dOxygen >= 1.5) {
    // 1.5 - 3.0 mg/L -> 15 to 35
    return Math.round((15 + ((dOxygen - 1.5) / 1.5) * 20) * 10) / 10;
  }
  // < 1.5 mg/L (Critical hypoxia/septic)
  return Math.max(0, Math.round((dOxygen / 1.5) * 15 * 10) / 10);
}

/**
 * Sub-index calculation for Turbidity (NTU)
 * BIS standard: 1 NTU acceptable, 5 NTU permissible. Industrial/storm runoff can reach 40-100+ NTU.
 */
export function getSubIndexTurbidity(turbidity: number): number {
  if (turbidity <= 1.0) return 100;
  if (turbidity <= 5.0) {
    // 1 - 5 NTU -> 90 to 100
    return Math.round((100 - ((turbidity - 1.0) / 4.0) * 10) * 10) / 10;
  }
  if (turbidity <= 15.0) {
    // 5 - 15 NTU -> 65 to 90
    return Math.round((90 - ((turbidity - 5.0) / 10.0) * 25) * 10) / 10;
  }
  if (turbidity <= 35.0) {
    // 15 - 35 NTU -> 35 to 65
    return Math.round((65 - ((turbidity - 15.0) / 20.0) * 30) * 10) / 10;
  }
  if (turbidity <= 70.0) {
    // 35 - 70 NTU -> 15 to 35
    return Math.round((35 - ((turbidity - 35.0) / 35.0) * 20) * 10) / 10;
  }
  // > 70 NTU
  const penalty = (turbidity - 70.0) * 0.2;
  return Math.max(0, Math.round((15 - penalty) * 10) / 10);
}

/**
 * Sub-index calculation for Total Dissolved Solids (TDS in ppm)
 * BIS IS 10500:2012: 500 ppm acceptable, 2000 ppm permissible.
 */
export function getSubIndexTDS(tds: number): number {
  if (tds <= 100) return 100;
  if (tds <= 250) {
    // 100 - 250 ppm -> 90 to 100
    return Math.round((100 - ((tds - 100) / 150) * 10) * 10) / 10;
  }
  if (tds <= 500) {
    // 250 - 500 ppm -> 75 to 90
    return Math.round((90 - ((tds - 250) / 250) * 15) * 10) / 10;
  }
  if (tds <= 1000) {
    // 500 - 1000 ppm -> 40 to 75
    return Math.round((75 - ((tds - 500) / 500) * 35) * 10) / 10;
  }
  if (tds <= 2000) {
    // 1000 - 2000 ppm -> 15 to 40
    return Math.round((40 - ((tds - 1000) / 1000) * 25) * 10) / 10;
  }
  // > 2000 ppm
  return Math.max(0, Math.round((15 - ((tds - 2000) / 1000) * 10) * 10) / 10);
}

/**
 * Sub-index calculation for Temperature (°C)
 * Ambient tropical river baseline ~ 20–25°C.
 */
export function getSubIndexTemperature(temp: number): number {
  if (temp >= 20.0 && temp <= 24.5) return 100;
  if (temp > 24.5 && temp <= 28.0) {
    // 24.5 - 28.0 °C -> 80 to 100
    return Math.round((100 - ((temp - 24.5) / 3.5) * 20) * 10) / 10;
  }
  if (temp > 28.0 && temp <= 32.0) {
    // 28.0 - 32.0 °C -> 45 to 80
    return Math.round((80 - ((temp - 28.0) / 4.0) * 35) * 10) / 10;
  }
  if (temp > 32.0) {
    // > 32 °C thermal discharge
    return Math.max(0, Math.round((45 - (temp - 32.0) * 7) * 10) / 10);
  }
  // Cold temperatures < 20 °C
  return Math.max(50, Math.round((100 - (20.0 - temp) * 5) * 10) / 10);
}

/**
 * Classify Water Quality Index into 4 canonical statuses:
 *  - >= 80 : Good
 *  - 60–79 : Moderate
 *  - 40–59 : Poor
 *  - < 40  : Very Poor
 */
export function classifyWQI(wqi: number): WQIStatus {
  if (wqi >= 80) return 'good';
  if (wqi >= 60) return 'moderate';
  if (wqi >= 40) return 'poor';
  return 'very-poor';
}

/**
 * Calculate the weighted-sum Water Quality Index (0 - 100)
 */
export function calculateWQI(params: WQIInput): number {
  const qDO = getSubIndexDO(params.do);
  const qPH = getSubIndexPH(params.ph);
  const qTurb = getSubIndexTurbidity(params.turbidity);
  const qTDS = getSubIndexTDS(params.tds);
  const qTemp = getSubIndexTemperature(params.temperature);

  const rawWQI =
    qDO * WQI_WEIGHTS.do +
    qPH * WQI_WEIGHTS.ph +
    qTurb * WQI_WEIGHTS.turbidity +
    qTDS * WQI_WEIGHTS.tds +
    qTemp * WQI_WEIGHTS.temperature;

  const clampedWQI = Math.max(0, Math.min(100, rawWQI));
  return Math.round(clampedWQI * 10) / 10;
}

/**
 * Calculate full WQI breakdown with sub-indices
 */
export function calculateWQIBreakdown(params: WQIInput): WQIBreakdown {
  const qDO = getSubIndexDO(params.do);
  const qPH = getSubIndexPH(params.ph);
  const qTurb = getSubIndexTurbidity(params.turbidity);
  const qTDS = getSubIndexTDS(params.tds);
  const qTemp = getSubIndexTemperature(params.temperature);

  const rawWQI =
    qDO * WQI_WEIGHTS.do +
    qPH * WQI_WEIGHTS.ph +
    qTurb * WQI_WEIGHTS.turbidity +
    qTDS * WQI_WEIGHTS.tds +
    qTemp * WQI_WEIGHTS.temperature;

  const wqi = Math.round(Math.max(0, Math.min(100, rawWQI)) * 10) / 10;
  const status = classifyWQI(wqi);

  return {
    wqi,
    status,
    subIndices: {
      do: qDO,
      ph: qPH,
      turbidity: qTurb,
      tds: qTDS,
      temperature: qTemp,
    },
    weights: { ...WQI_WEIGHTS },
  };
}

// =============================================================================
// BIS IS 10500:2012 Drinking Water Specification & CPCB River Water Limits
// =============================================================================

export interface ParameterLimitConfig {
  key: 'ph' | 'do' | 'turbidity' | 'tds' | 'conductivity' | 'temperature';
  name: string;
  unit: string;
  acceptableMin?: number;
  acceptableMax?: number;
  permissibleMin?: number;
  permissibleMax?: number;
  standard: string;
  criterionText: string;
  description: string;
}

/**
 * BIS IS 10500:2012 & CPCB Permissible Limits Constant
 */
export const BIS_LIMITS: Record<string, ParameterLimitConfig> = {
  ph: {
    key: 'ph',
    name: 'pH',
    unit: 'pH',
    acceptableMin: 6.5,
    acceptableMax: 8.5,
    permissibleMin: 6.5,
    permissibleMax: 8.5,
    standard: 'BIS IS 10500:2012',
    criterionText: '6.5 – 8.5',
    description: 'Permissible range 6.5–8.5. Values outside cause skin/mucosa irritation or heavy metal leaching.',
  },
  do: {
    key: 'do',
    name: 'Dissolved Oxygen',
    unit: 'mg/L',
    acceptableMin: 5.0,
    acceptableMax: 14.0,
    permissibleMin: 4.0, // Critical ecosystem survival threshold
    permissibleMax: 14.0,
    standard: 'CPCB / BIS Class B',
    criterionText: '≥ 5.0 mg/L (min 4.0 mg/L)',
    description: 'Minimum 5.0 mg/L required for outdoor bathing & ecological health. Below 4.0 mg/L creates severe fish distress.',
  },
  turbidity: {
    key: 'turbidity',
    name: 'Turbidity',
    unit: 'NTU',
    acceptableMin: 0,
    acceptableMax: 1.0,
    permissibleMin: 0,
    permissibleMax: 5.0,
    standard: 'BIS IS 10500:2012',
    criterionText: '≤ 1.0 NTU (Max 5.0 NTU)',
    description: 'Acceptable limit is 1 NTU; 5 NTU permissible without alternative source. High turbidity shields pathogenic bacteria.',
  },
  tds: {
    key: 'tds',
    name: 'Total Dissolved Solids',
    unit: 'ppm',
    acceptableMin: 0,
    acceptableMax: 500,
    permissibleMin: 0,
    permissibleMax: 2000,
    standard: 'BIS IS 10500:2012',
    criterionText: '≤ 500 ppm (Max 2000 ppm)',
    description: '500 ppm desirable limit; up to 2000 ppm permitted in absence of alternative sources.',
  },
  conductivity: {
    key: 'conductivity',
    name: 'Electrical Conductivity',
    unit: 'µS/cm',
    acceptableMin: 0,
    acceptableMax: 750,
    permissibleMin: 0,
    permissibleMax: 1500,
    standard: 'CPCB / WHO Guidelines',
    criterionText: '≤ 750 µS/cm (Max 1500 µS/cm)',
    description: 'Indirect measure of dissolved ions. Surges indicate untreated chemical effluent or untreated sewage.',
  },
  temperature: {
    key: 'temperature',
    name: 'Water Temperature',
    unit: '°C',
    acceptableMin: 18.0,
    acceptableMax: 28.0,
    permissibleMin: 15.0,
    permissibleMax: 32.0,
    standard: 'CPCB River Water Criteria',
    criterionText: '18.0 – 28.0 °C',
    description: 'Normal seasonal river range. Warm discharges (>30°C) reduce dissolved oxygen capacity.',
  },
};

export type LimitComplianceStatus = 'within_limit' | 'exceeds_limit';

export interface LimitCheckResult {
  isWithinLimit: boolean;
  status: LimitComplianceStatus;
  statusText: 'within limit' | 'exceeds limit';
  acceptable: boolean;
  value: number;
  limitText: string;
  message: string;
}

/**
 * Compare any reading parameter against BIS IS 10500:2012 limits
 * Returns "within limit" or "exceeds limit" along with context.
 */
export function checkParameterLimit(
  parameter: 'ph' | 'do' | 'turbidity' | 'tds' | 'conductivity' | 'temperature',
  value: number
): LimitCheckResult {
  const limit = BIS_LIMITS[parameter];
  if (!limit) {
    return {
      isWithinLimit: true,
      status: 'within_limit',
      statusText: 'within limit',
      acceptable: true,
      value,
      limitText: 'N/A',
      message: 'Parameter standard undefined',
    };
  }

  // Handle parameters where LOWER than min is an excursion (e.g. Dissolved Oxygen)
  if (parameter === 'do') {
    const isWithinPermissible = value >= (limit.permissibleMin ?? 4.0);
    const isAcceptable = value >= (limit.acceptableMin ?? 5.0);
    return {
      isWithinLimit: isWithinPermissible,
      status: isWithinPermissible ? 'within_limit' : 'exceeds_limit',
      statusText: isWithinPermissible ? 'within limit' : 'exceeds limit',
      acceptable: isAcceptable,
      value,
      limitText: limit.criterionText,
      message: !isWithinPermissible
        ? `Critically low DO (${value.toFixed(1)} mg/L < ${limit.permissibleMin} mg/L permissible minimum)`
        : !isAcceptable
        ? `Marginal DO (${value.toFixed(1)} mg/L below 5.0 mg/L optimal standard)`
        : `Optimal Dissolved Oxygen level (${value.toFixed(1)} mg/L)`,
    };
  }

  // Handle parameters where both min and max matter (e.g. pH, Temperature)
  if (limit.acceptableMin !== undefined && limit.permissibleMax !== undefined) {
    const minVal = limit.permissibleMin ?? limit.acceptableMin;
    const maxVal = limit.permissibleMax;
    const isWithinPermissible = value >= minVal && value <= maxVal;
    const isAcceptable =
      value >= (limit.acceptableMin ?? minVal) &&
      value <= (limit.acceptableMax ?? maxVal);

    return {
      isWithinLimit: isWithinPermissible,
      status: isWithinPermissible ? 'within_limit' : 'exceeds_limit',
      statusText: isWithinPermissible ? 'within limit' : 'exceeds limit',
      acceptable: isAcceptable,
      value,
      limitText: limit.criterionText,
      message: !isWithinPermissible
        ? `Exceeds BIS IS 10500 standard (${value.toFixed(1)} outside ${minVal}–${maxVal} ${limit.unit})`
        : !isAcceptable
        ? `Slightly beyond desirable limit, but within permissible envelope`
        : `Within desirable BIS limit (${value.toFixed(1)} ${limit.unit})`,
    };
  }

  // Parameters with an upper ceiling (Turbidity, TDS, Conductivity)
  const maxPermissible = limit.permissibleMax ?? Infinity;
  const maxAcceptable = limit.acceptableMax ?? maxPermissible;
  const isWithinPermissible = value <= maxPermissible;
  const isAcceptable = value <= maxAcceptable;

  return {
    isWithinLimit: isWithinPermissible,
    status: isWithinPermissible ? 'within_limit' : 'exceeds_limit',
    statusText: isWithinPermissible ? 'within limit' : 'exceeds limit',
    acceptable: isAcceptable,
    value,
    limitText: limit.criterionText,
    message: !isWithinPermissible
      ? `Exceeds BIS IS 10500 permissible limit (${value.toFixed(1)} > ${maxPermissible} ${limit.unit})`
      : !isAcceptable
      ? `Above desirable limit (${maxAcceptable} ${limit.unit}) but within permissible ceiling`
      : `Within desirable BIS limit (${value.toFixed(1)} ${limit.unit})`,
  };
}
