/** Worker error occurred */
export interface ErrorResponse {
    type: 'error';
    message: string;
    featureId?: string;
}
