import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ApiResponse, Device } from '../types';

export const devicesRouter = Router();

const createDeviceSchema = z.object({
  id: z.string().min(1, 'Device ID is required'),
  stationName: z.string().min(1, 'Station Name is required'),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    description: z.string().min(1),
  }),
  firmwareVersion: z.string().optional(),
});

devicesRouter.get('/', (req: Request, res: Response<ApiResponse<Device[]>>) => {
  const devices: Device[] = [
    {
      id: 'node-alandi-01',
      stationName: 'Alandi Holy Ghat',
      location: {
        lat: 18.6775,
        lng: 73.8967,
        description: 'Alandi Indrayani River Ghat near Sant Dnyaneshwar Maharaj Samadhi',
      },
      status: 'online',
      lastSeen: new Date().toISOString(),
      batteryLevel: 98,
      firmwareVersion: '1.0.4',
    },
    {
      id: 'node-dehu-01',
      stationName: 'Dehu Temple Ghat',
      location: {
        lat: 18.7189,
        lng: 73.7699,
        description: 'Dehu Indrayani Ghat near Sant Tukaram Maharaj Temple',
      },
      status: 'online',
      lastSeen: new Date().toISOString(),
      batteryLevel: 92,
      firmwareVersion: '1.0.4',
    },
  ];

  return res.status(200).json({ data: devices });
});

devicesRouter.post('/', (req: Request, res: Response<ApiResponse<Device>>) => {
  const parseResult = createDeviceSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: `Validation failed: ${parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    });
  }

  const payload = parseResult.data;
  const newDevice: Device = {
    id: payload.id,
    stationName: payload.stationName,
    location: payload.location,
    status: 'online',
    lastSeen: new Date().toISOString(),
    firmwareVersion: payload.firmwareVersion || '1.0.0',
  };

  return res.status(201).json({ data: newDevice });
});
