export class DomainError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const deny = () => { throw new DomainError(404, "RESOURCE_UNAVAILABLE", "منبع در دسترس نیست."); };
export const requireManager = (context) => {
  if (!["owner", "admin", "project_manager"].includes(context.role)) {
    throw new DomainError(403, "PERMISSION_DENIED", "برای این کار مجوز ندارید.");
  }
};
export const requireAdmin = (context) => {
  if (!["owner", "admin"].includes(context.role)) {
    throw new DomainError(403, "PERMISSION_DENIED", "برای این کار مجوز ندارید.");
  }
};
export function text(value, name, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new DomainError(400, "INVALID_INPUT", `${name} معتبر نیست.`);
  }
  return value.trim();
}
export function pagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? 25 : Number(query.pageSize);
  if (!Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new DomainError(400, "INVALID_PAGINATION", "صفحه‌بندی معتبر نیست.");
  }
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}
