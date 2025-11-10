import request from "supertest";
import { createApp } from "@/app";

describe("health endpoint", () => {
  it("returns status ok", async () => {
    const response = await request(createApp()).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
});


