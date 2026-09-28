/**
 * Conversion Error
 * Standardized error class for conversion lifecycle errors and exceptions.
 */
export class ConversionError extends Error {
  /**
   * @param {string} message
   * @param {'UNSUPPORTED_FORMAT' | 'NO_CONVERTER' | 'CANCELLED' | 'CORRUPTED_FILE' | 'CONVERSION_FAILED'} code
   * @param {Error} [originalError]
   */
  constructor(message, code = 'CONVERSION_FAILED', originalError = null) {
    super(message);
    this.name = 'ConversionError';
    this.code = code;
    this.originalError = originalError;
  }
}
