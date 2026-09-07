export const SITE_NAME = "Toronto Parking";

export const SITE_URL = "https://cars.mlaws.ca";

export const METADATA_BASE = new URL(SITE_URL);

export const SITE_DESCRIPTION =
  "A numbered deck of 60 layouts for a 3D-printed sliding-car puzzle.";

/**
 * The month printed on every dedication, one month for all four boards.
 * Confirmed by Martin 2026-09-07; it reaches every board page as
 * "Board n of 4. Printed in Toronto, September 2026. — Martin", so changing it
 * changes what four people are told and wants a deliberate redeploy.
 */
export const PRINTED = "September 2026";
