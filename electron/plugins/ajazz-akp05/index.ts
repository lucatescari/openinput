import type { DevicePlugin } from '../../../shared/types/device-plugin.types';
import { AKP05Protocol } from './protocol';

export const akp05Plugin: DevicePlugin = {
  meta: {
    id: 'ajazz-akp05',
    name: 'AJAZZ AKP05',
    layout: {
      keys: {
        rows: 2,
        cols: 5,
        count: 10,
        imageSpec: {
          width: 112,
          height: 112,
          rotation: 180,
          format: 'jpeg',
          quality: 90,
          maxBytes: 20480,
        },
      },
      encoders: {
        count: 4,
        hasPress: true,
      },
      touchZones: {
        count: 4,
        imageSpec: {
          width: 176,
          height: 112,
          rotation: 180,
          format: 'jpeg',
          quality: 90,
          maxBytes: 20480,
        },
      },
      swipe: true,
    },
    match: [
      {
        vendorId: 0x0300,
        productIds: [0x3006, 0x3004, 0x3013],
        usagePage: 0xffa0,
      },
    ],
  },

  createProtocol() {
    return new AKP05Protocol();
  },
};
