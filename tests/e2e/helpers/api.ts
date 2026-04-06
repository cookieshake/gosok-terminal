import { type APIRequestContext } from "@playwright/test";
import { PORT } from "../playwright.config";

const BASE = `http://localhost:${PORT}`;

export class ApiHelper {
  constructor(private request: APIRequestContext) {}

  async get(path: string): Promise<any> {
    const resp = await this.request.get(`${BASE}${path}`);
    if (resp.ok()) {
      const text = await resp.text();
      return text ? JSON.parse(text) : null;
    }
    return null;
  }

  async post(path: string, data?: any): Promise<any> {
    const resp = await this.request.post(`${BASE}${path}`, { data });
    const text = await resp.text();
    const body = text ? JSON.parse(text) : {};
    if (!resp.ok()) {
      throw new Error(`API POST ${path} failed (${resp.status()}): ${JSON.stringify(body)}`);
    }
    return body;
  }

  async put(path: string, data?: any): Promise<any> {
    const resp = await this.request.put(`${BASE}${path}`, { data });
    const text = await resp.text();
    const body = text ? JSON.parse(text) : {};
    if (!resp.ok()) {
      throw new Error(`API PUT ${path} failed (${resp.status()}): ${JSON.stringify(body)}`);
    }
    return body;
  }

  async delete(path: string): Promise<void> {
    await this.request.delete(`${BASE}${path}`);
  }
}
