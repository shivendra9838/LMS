const normalizeSuccess = (body) => {
  const source = body && typeof body === 'object' ? body : { data: body };

  if (source.success === true) {
    const { success, message, data, meta, pagination, ...rest } = source;
    return {
      success: true,
      message: message || 'OK',
      data: data !== undefined ? data : rest,
      meta: meta || pagination || {}
    };
  }

  return {
    success: true,
    message: source.message || 'OK',
    data: source.data !== undefined ? source.data : source,
    meta: source.meta || source.pagination || {}
  };
};

const normalizeError = (body) => {
  const source = body && typeof body === 'object' ? body : {};

  return {
    success: false,
    message: source.message || 'Request failed',
    errors: source.errors || []
  };
};

const responseFormatter = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (res.headersSent) {
      return originalJson(body);
    }

    const formattedBody = body?.success === false || res.statusCode >= 400
      ? normalizeError(body)
      : normalizeSuccess(body);

    return originalJson(formattedBody);
  };

  next();
};

module.exports = responseFormatter;
