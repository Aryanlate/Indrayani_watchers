/**
 * Water Quality Index (WQI) calculation module for Indrayani River monitoring.
 * Standardizes raw sensor inputs into an aggregate 0-100 score.
 */

export interface WqiInput {
  ph: number;
  dissolvedOxygen: number; // mg/L
  turbidity: number; // NTU
  temperature: number; // °C
  conductivity: number; // µS/cm
  tds?: number; // ppm
}

export type WqiRating = 'Good' | 'Moderate' | 'Poor' | 'Very Poor' | 'Severe';

export interface WqiResult {
  score: number;
  rating: WqiRating;
  subIndices: {
    ph: number;
    dissolvedOxygen: number;
    turbidity: number;
    conductivity: number;
  };
}

/**
 * Calculates a preliminary Water Quality Index (0-100) based on river standard weightings.
 */
export function calculateWqi(params: WqiInput): WqiResult {
  // Sub-index for pH (ideal 6.5 - 8.5)
  let qPh = 100;
  if (params.ph < 6.5) {
    qPh = Math.max(0, 100 - (6.5 - params.ph) * 35);
  } else if (params.ph > 8.5) {
    qPh = Math.max(0, 100 - (params.ph - 8.5) * 35);
  }

  // Sub-index for Dissolved Oxygen (ideal > 6.0 mg/L)
  let qDo = Math.min(100, Math.max(0, (params.dissolvedOxygen / 7.5) * 100));

  // Sub-index for Turbidity (ideal < 5 NTU)
  let qTurbidity = Math.max(0, 100 - (params.turbidity / 50) * 100);

  // Sub-index for Conductivity (ideal < 300 µS/cm)
  let qConductivity = Math.max(0, 100 - (params.conductivity / 1000) * 100);

  // Weighted aggregation
  const score = Math.round(
    qPh * 0.3 + qDo * 0.35 + qTurbidity * 0.2 + qConductivity * 0.15
  );

  let rating: WqiRating = 'Good';
  if (score >= 80) rating = 'Good';
  else if (score >= 60) rating = 'Moderate';
  else if (score >= 40) rating = 'Poor';
  else if (score >= 20) rating = 'Very Poor';
  else rating = 'Severe';

  return {
    score: Math.max(0, Math.min(100, score)),
    rating,
    subIndices: {
      ph: Math.round(qPh),
      dissolvedOxygen: Math.round(qDo),
      turbidity: Math.round(qTurbidity),
      conductivity: Math.round(qConductivity),
    },
  };
}
