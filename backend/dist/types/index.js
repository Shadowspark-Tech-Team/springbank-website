"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionStatus = exports.TransactionType = exports.AccountType = exports.UserRole = void 0;
/**
 * Re-exports shared enums from @springbank/shared so that backend code can
 * import a single canonical set of values that is also used by the frontend.
 * This eliminates enum drift between layers.
 */
const shared_1 = require("@springbank/shared");
Object.defineProperty(exports, "UserRole", { enumerable: true, get: function () { return shared_1.UserRole; } });
Object.defineProperty(exports, "AccountType", { enumerable: true, get: function () { return shared_1.AccountType; } });
Object.defineProperty(exports, "TransactionType", { enumerable: true, get: function () { return shared_1.TransactionType; } });
Object.defineProperty(exports, "TransactionStatus", { enumerable: true, get: function () { return shared_1.TransactionStatus; } });
//# sourceMappingURL=index.js.map