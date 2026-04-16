const { AppError, notFound, errorHandler } = require("../../middleware/errorHandler");

describe("errorHandler middleware", () => {
  test("AppError sets status and operational flags", () => {
    const error = new AppError("Bad request", 400);
    expect(error.message).toBe("Bad request");
    expect(error.statusCode).toBe(400);
    expect(error.status).toBe("fail");
    expect(error.isOperational).toBe(true);
  });

  test("notFound creates 404 AppError", () => {
    const req = { originalUrl: "/missing" };
    const next = jest.fn();

    notFound(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
  });

  test("errorHandler returns normalized error response", () => {
    const err = new Error("Oops");
    const req = {
      method: "GET",
      originalUrl: "/api/test",
      body: {},
      params: {},
      query: {},
      session: null,
    };

    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const res = { status, json };

    errorHandler(err, req, res, jest.fn());

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "Oops",
        statusCode: 500,
      }),
    );
  });
});



