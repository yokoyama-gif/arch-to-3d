import type { LayoutObject } from '../../models/types';

export const calculateSeating = (objects: LayoutObject[]) => {
  const totalSeats = objects.reduce((sum, object) => sum + object.seatCount, 0);
  const meetingSeats = objects
    .filter((object) => object.category === 'meeting')
    .reduce((sum, object) => sum + object.seatCount, 0);

  return { totalSeats, meetingSeats };
};
