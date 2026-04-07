import { describe, it, expect } from 'vitest';
import { generateCode } from './codegen';
import { Endpoint } from '../types';

describe('API Code Generation', () => {
  const mockEndpoint: Endpoint = {
    id: 'test-ep',
    method: 'POST',
    path: '/api/v1/users',
    latency: 50
  };

  it('should generate valid cURL syntax', () => {
    const result = generateCode(mockEndpoint, 'curl');
    expect(result).toContain('curl -X POST "http://localhost:3000/api/v1/users"');
    expect(result).toContain('-H "Content-Type: application/json"');
  });

  it('should generate valid fetch API syntax', () => {
    const result = generateCode(mockEndpoint, 'javascript');
    expect(result).toContain('fetch("http://localhost:3000/api/v1/users"');
    expect(result).toContain('method: "POST"');
  });

  it('should generate valid Axios syntax', () => {
    const result = generateCode(mockEndpoint, 'axios');
    expect(result).toContain("import axios from 'axios'");
    expect(result).toContain('url: "http://localhost:3000/api/v1/users"');
    expect(result).toContain('method: "post"');
  });

  it('should generate valid Python requests syntax', () => {
    const result = generateCode(mockEndpoint, 'python');
    expect(result).toContain('import requests');
    expect(result).toContain('requests.post("http://localhost:3000/api/v1/users")');
  });

  it('should return an empty string for unknown languages', () => {
    const result = generateCode(mockEndpoint, 'rust');
    expect(result).toBe('');
  });
});
