const MAP = {
  diajukan: 'OrderCreated',
  created: 'OrderCreated',
  packing: 'OrderCreated',
  dijemput: 'PickedUp',
  'picked up': 'PickedUp',
  pickup: 'PickedUp',
  dikirim: 'InTransit',
  'in transit': 'InTransit',
  transit: 'InTransit',
  'on process': 'InTransit',
  selesai: 'Delivered',
  delivered: 'Delivered',
  diterima: 'Delivered',
  dibatalkan: 'Cancelled',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
};

const mapKomshipStatus = (status = '') => MAP[String(status).trim().toLowerCase()] || 'Problem';

module.exports = { mapKomshipStatus };
