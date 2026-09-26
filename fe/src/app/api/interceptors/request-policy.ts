import { HttpContextToken } from '@angular/common/http';

/** A side-effecting provider request must wait for a deliberate user retry. */
export const NO_AUTOMATIC_REPLAY = new HttpContextToken<boolean>(() => false);
