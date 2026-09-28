/**
 * Converter Registry
 * Stores and resolves modular converter implementations by input and output capabilities.
 */
import { BaseConverter } from './base-converter.js';

export class ConverterRegistry {
  constructor() {
    /** @type {Map<string, BaseConverter>} */
    this.converters = new Map();
  }

  /**
   * Register a new converter instance
   * @param {BaseConverter} converter
   */
  register(converter) {
    if (!converter || typeof converter.canConvert !== 'function' || typeof converter.convert !== 'function') {
      throw new Error('Converter must implement the BaseConverter interface (canConvert, convert)');
    }
    if (!converter.id || typeof converter.id !== 'string') {
      throw new Error('Converter must have a valid string id');
    }
    this.converters.set(converter.id, converter);
  }

  /**
   * Unregister a converter by ID
   * @param {string} id
   * @returns {boolean}
   */
  unregister(id) {
    return this.converters.delete(id);
  }

  /**
   * Get a converter by ID
   * @param {string} id
   * @returns {BaseConverter | undefined}
   */
  get(id) {
    return this.converters.get(id);
  }

  /**
   * Get all registered converters
   * @returns {BaseConverter[]}
   */
  getAll() {
    return Array.from(this.converters.values());
  }

  /**
   * Find a converter capable of converting input to outputFormat
   * @param {File | string} fileOrType - Input file or format string
   * @param {string} outputFormat - Desired output format extension
   * @returns {BaseConverter | null}
   */
  findConverter(fileOrType, outputFormat) {
    for (const converter of this.converters.values()) {
      if (converter.canConvert(fileOrType, outputFormat)) {
        return converter;
      }
    }
    return null;
  }

  /**
   * Find all converters that accept the given input
   * @param {File | string} fileOrType
   * @returns {BaseConverter[]}
   */
  findConvertersForInput(fileOrType) {
    return Array.from(this.converters.values()).filter(c => c.canConvert(fileOrType));
  }

  /**
   * Get all aggregated output formats possible for an input across all registered converters
   * @param {File | string} fileOrType
   * @returns {string[]} Array of unique lowercase output formats
   */
  getAvailableOutputs(fileOrType) {
    const outputs = new Set();
    for (const converter of this.converters.values()) {
      const formats = converter.getAvailableOutputs(fileOrType);
      for (const fmt of formats) {
        outputs.add(fmt.toLowerCase());
      }
    }
    return Array.from(outputs);
  }

  /**
   * Check if any registered converter supports the given input and output format
   * @param {File | string} fileOrType
   * @param {string} outputFormat
   * @returns {boolean}
   */
  hasConverterFor(fileOrType, outputFormat) {
    return this.findConverter(fileOrType, outputFormat) !== null;
  }

  /**
   * Clear all registered converters
   */
  clear() {
    this.converters.clear();
  }
}
