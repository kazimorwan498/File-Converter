/**
 * Converter Manager
 * Registry and orchestrator for offline converters.
 * Converters will be registered in Phase 3 & 4.
 */
export class ConverterManager {
  constructor() {
    this.converters = new Map();
  }

  registerConverter(converter) {
    this.converters.set(converter.id, converter);
  }

  getConverter(id) {
    return this.converters.get(id);
  }

  findConvertersForType(mimeType) {
    return Array.from(this.converters.values()).filter(c => c.canConvert(mimeType));
  }
}
