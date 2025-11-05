import {
	clearStorage,
	getStorageItem,
	getStorageJSON,
	isStorageAvailable,
	removeStorageItem,
	setStorageItem,
	setStorageJSON,
} from "c/storageUtils";

describe("c-storage-utils", () => {
	beforeEach(() => {
		// Clear localStorage before each test
		localStorage.clear();
		jest.clearAllMocks();
	});

	describe("isStorageAvailable", () => {
		it("should return true when localStorage is available", () => {
			expect(isStorageAvailable()).toBe(true);
		});

		it("should return false when localStorage throws error", () => {
			// Mock localStorage to throw
			const originalSetItem = Storage.prototype.setItem;
			Storage.prototype.setItem = jest.fn(() => {
				throw new Error("QuotaExceededError");
			});

			expect(isStorageAvailable()).toBe(false);

			// Restore
			Storage.prototype.setItem = originalSetItem;
		});
	});

	describe("getStorageItem", () => {
		it("should retrieve existing item from localStorage", () => {
			localStorage.setItem("testKey", "testValue");
			expect(getStorageItem("testKey")).toBe("testValue");
		});

		it("should return default value for non-existent key", () => {
			expect(getStorageItem("nonExistent", "default")).toBe("default");
		});

		it("should return null when key does not exist and no default provided", () => {
			expect(getStorageItem("nonExistent")).toBeNull();
		});

		it("should handle localStorage errors gracefully", () => {
			const originalGetItem = Storage.prototype.getItem;
			Storage.prototype.getItem = jest.fn(() => {
				throw new Error("Storage error");
			});

			expect(getStorageItem("testKey", "fallback")).toBe("fallback");

			Storage.prototype.getItem = originalGetItem;
		});
	});

	describe("setStorageItem", () => {
		it("should store item in localStorage", () => {
			const result = setStorageItem("testKey", "testValue");
			expect(result).toBe(true);
			expect(localStorage.getItem("testKey")).toBe("testValue");
		});

		it("should return false when storage is not available", () => {
			const originalSetItem = Storage.prototype.setItem;
			Storage.prototype.setItem = jest.fn(() => {
				throw new Error("QuotaExceededError");
			});

			const result = setStorageItem("testKey", "testValue");
			expect(result).toBe(false);

			Storage.prototype.setItem = originalSetItem;
		});

		it("should handle null values", () => {
			const result = setStorageItem("testKey", null);
			expect(result).toBe(true);
			expect(localStorage.getItem("testKey")).toBe("null");
		});

		it("should handle undefined values", () => {
			const result = setStorageItem("testKey", undefined);
			expect(result).toBe(true);
			expect(localStorage.getItem("testKey")).toBe("undefined");
		});
	});

	describe("getStorageJSON", () => {
		it("should parse and return valid JSON object", () => {
			const testObj = { name: "test", value: 123 };
			localStorage.setItem("jsonKey", JSON.stringify(testObj));

			const result = getStorageJSON("jsonKey");
			expect(result).toEqual(testObj);
		});

		it("should return default value for invalid JSON", () => {
			localStorage.setItem("invalidJson", "not valid json {]");
			const defaultValue = { error: true };

			const result = getStorageJSON("invalidJson", defaultValue);
			expect(result).toEqual(defaultValue);
		});

		it("should return default value for non-existent key", () => {
			const defaultValue = { default: true };
			const result = getStorageJSON("nonExistent", defaultValue);
			expect(result).toEqual(defaultValue);
		});

		it("should return null when no default provided and key missing", () => {
			const result = getStorageJSON("nonExistent");
			expect(result).toBeNull();
		});

		it("should handle complex nested objects", () => {
			const complexObj = {
				level1: {
					level2: {
						array: [1, 2, 3],
						bool: true,
						nullVal: null,
					},
				},
			};
			localStorage.setItem("complex", JSON.stringify(complexObj));

			const result = getStorageJSON("complex");
			expect(result).toEqual(complexObj);
		});
	});

	describe("setStorageJSON", () => {
		it("should stringify and store object", () => {
			const testObj = { name: "test", value: 456 };
			const result = setStorageJSON("jsonKey", testObj);

			expect(result).toBe(true);
			expect(JSON.parse(localStorage.getItem("jsonKey"))).toEqual(testObj);
		});

		it("should return false on serialization error", () => {
			// Create circular reference
			const circularObj = {};
			circularObj.self = circularObj;

			const result = setStorageJSON("circular", circularObj);
			expect(result).toBe(false);
		});

		it("should handle arrays", () => {
			const testArray = [1, 2, 3, { nested: true }];
			const result = setStorageJSON("arrayKey", testArray);

			expect(result).toBe(true);
			expect(JSON.parse(localStorage.getItem("arrayKey"))).toEqual(testArray);
		});

		it("should return false when storage quota exceeded", () => {
			const originalSetItem = Storage.prototype.setItem;
			Storage.prototype.setItem = jest.fn(() => {
				throw new DOMException("QuotaExceededError");
			});

			const result = setStorageJSON("testKey", { data: "test" });
			expect(result).toBe(false);

			Storage.prototype.setItem = originalSetItem;
		});
	});

	describe("removeStorageItem", () => {
		it("should remove existing item", () => {
			localStorage.setItem("toRemove", "value");
			expect(localStorage.getItem("toRemove")).toBe("value");

			const result = removeStorageItem("toRemove");
			expect(result).toBe(true);
			expect(localStorage.getItem("toRemove")).toBeNull();
		});

		it("should return true even if key does not exist", () => {
			const result = removeStorageItem("nonExistent");
			expect(result).toBe(true);
		});

		it("should handle errors gracefully", () => {
			const originalRemoveItem = Storage.prototype.removeItem;
			Storage.prototype.removeItem = jest.fn(() => {
				throw new Error("Storage error");
			});

			const result = removeStorageItem("testKey");
			expect(result).toBe(false);

			Storage.prototype.removeItem = originalRemoveItem;
		});
	});

	describe("clearStorage", () => {
		it("should clear all items from localStorage", () => {
			localStorage.setItem("key1", "value1");
			localStorage.setItem("key2", "value2");
			localStorage.setItem("key3", "value3");
			expect(localStorage.length).toBe(3);

			const result = clearStorage();
			expect(result).toBe(true);
			expect(localStorage.length).toBe(0);
		});

		it("should return true even if storage is already empty", () => {
			expect(localStorage.length).toBe(0);
			const result = clearStorage();
			expect(result).toBe(true);
		});

		it("should handle errors gracefully", () => {
			const originalClear = Storage.prototype.clear;
			Storage.prototype.clear = jest.fn(() => {
				throw new Error("Storage error");
			});

			const result = clearStorage();
			expect(result).toBe(false);

			Storage.prototype.clear = originalClear;
		});
	});

	describe("Edge Cases", () => {
		it("should handle very large strings", () => {
			const largeString = "x".repeat(10000);
			const result = setStorageItem("large", largeString);
			expect(result).toBe(true);
			expect(getStorageItem("large")).toBe(largeString);
		});

		it("should handle special characters in keys", () => {
			const specialKey = "key-with-special_chars.123";
			setStorageItem(specialKey, "value");
			expect(getStorageItem(specialKey)).toBe("value");
		});

		it("should handle empty string values", () => {
			setStorageItem("emptyKey", "");
			expect(getStorageItem("emptyKey")).toBe("");
		});
	});
});
