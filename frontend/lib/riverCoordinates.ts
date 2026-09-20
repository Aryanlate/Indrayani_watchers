/**
 * Indrayani River Geographic Course (GeoJSON Coordinates)
 * Upstream (Dehu) -> Downstream (Confluence)
 * 
 * Format: [longitude, latitude] (GeoJSON standard)
 * This single editable array defines the river geometry and can be calibrated
 * with high-precision GPS survey logs.
 */
export const RIVER_COORDINATES: [number, number][] = [
  // S1: Dehu Ghat (Upstream reference)
  [73.7620, 18.7170],
  [73.7710, 18.7135],
  [73.7820, 18.7050],
  [73.7940, 18.6970],
  [73.8050, 18.6880],
  [73.8160, 18.6790],

  // S4: Chikhali (Bhosari MIDC effluent influx)
  [73.8250, 18.6730],
  [73.8340, 18.6750],
  [73.8400, 18.6765],

  // S3: Moshi River Bridge (Highway crossing)
  [73.8450, 18.6770],
  [73.8560, 18.6795],
  [73.8680, 18.6820],
  [73.8780, 18.6815],
  [73.8850, 18.6800],
  [73.8910, 18.6785],

  // S2: Alandi Temple Area (Pilgrimage ghat)
  [73.8970, 18.6770],
  [73.8985, 18.6730],
  [73.8990, 18.6700],
  [73.8985, 18.6660],

  // S5: Charholi / Nirgudi (Industrial downstream)
  [73.8980, 18.6620],
  [73.9020, 18.6590],
  [73.9080, 18.6560],
  [73.9140, 18.6530],

  // S6: Downstream Confluence (Bhima river drainage)
  [73.9200, 18.6500],
];

/**
 * Returns GeoJSON Feature for the entire Indrayani river course
 */
export function getRiverGeoJSON() {
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {
          name: 'Indrayani River',
          lengthKm: 42.8,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: RIVER_COORDINATES,
        },
      },
    ],
  };
}

/**
 * Approximate line progress percentage for each station along the river line (0.0 to 1.0)
 * Used to calculate the continuous gradient stops along the river path.
 */
export const STATION_PROGRESS_STOPS: Record<string, number> = {
  S1: 0.0,   // Dehu (Start)
  S4: 0.28,  // Chikhali
  S3: 0.44,  // Moshi
  S2: 0.68,  // Alandi
  S5: 0.84,  // Charholi
  S6: 1.0,   // Confluence (End)
};
