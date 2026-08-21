var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/.pnpm/fast-json-patch@3.1.1/node_modules/fast-json-patch/commonjs/helpers.js
var require_helpers = __commonJS({
  "node_modules/.pnpm/fast-json-patch@3.1.1/node_modules/fast-json-patch/commonjs/helpers.js"(exports) {
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d2, b2) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
          d3.__proto__ = b3;
        } || function(d3, b3) {
          for (var p2 in b3) if (b3.hasOwnProperty(p2)) d3[p2] = b3[p2];
        };
        return extendStatics(d2, b2);
      };
      return function(d2, b2) {
        extendStatics(d2, b2);
        function __() {
          this.constructor = d2;
        }
        d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    var _hasOwnProperty = Object.prototype.hasOwnProperty;
    function hasOwnProperty(obj, key) {
      return _hasOwnProperty.call(obj, key);
    }
    exports.hasOwnProperty = hasOwnProperty;
    function _objectKeys(obj) {
      if (Array.isArray(obj)) {
        var keys_1 = new Array(obj.length);
        for (var k2 = 0; k2 < keys_1.length; k2++) {
          keys_1[k2] = "" + k2;
        }
        return keys_1;
      }
      if (Object.keys) {
        return Object.keys(obj);
      }
      var keys = [];
      for (var i in obj) {
        if (hasOwnProperty(obj, i)) {
          keys.push(i);
        }
      }
      return keys;
    }
    exports._objectKeys = _objectKeys;
    function _deepClone(obj) {
      switch (typeof obj) {
        case "object":
          return JSON.parse(JSON.stringify(obj));
        //Faster than ES5 clone - http://jsperf.com/deep-cloning-of-objects/5
        case "undefined":
          return null;
        //this is how JSON.stringify behaves for array items
        default:
          return obj;
      }
    }
    exports._deepClone = _deepClone;
    function isInteger(str) {
      var i = 0;
      var len = str.length;
      var charCode;
      while (i < len) {
        charCode = str.charCodeAt(i);
        if (charCode >= 48 && charCode <= 57) {
          i++;
          continue;
        }
        return false;
      }
      return true;
    }
    exports.isInteger = isInteger;
    function escapePathComponent(path) {
      if (path.indexOf("/") === -1 && path.indexOf("~") === -1)
        return path;
      return path.replace(/~/g, "~0").replace(/\//g, "~1");
    }
    exports.escapePathComponent = escapePathComponent;
    function unescapePathComponent(path) {
      return path.replace(/~1/g, "/").replace(/~0/g, "~");
    }
    exports.unescapePathComponent = unescapePathComponent;
    function _getPathRecursive(root, obj) {
      var found;
      for (var key in root) {
        if (hasOwnProperty(root, key)) {
          if (root[key] === obj) {
            return escapePathComponent(key) + "/";
          } else if (typeof root[key] === "object") {
            found = _getPathRecursive(root[key], obj);
            if (found != "") {
              return escapePathComponent(key) + "/" + found;
            }
          }
        }
      }
      return "";
    }
    exports._getPathRecursive = _getPathRecursive;
    function getPath(root, obj) {
      if (root === obj) {
        return "/";
      }
      var path = _getPathRecursive(root, obj);
      if (path === "") {
        throw new Error("Object not found in root");
      }
      return "/" + path;
    }
    exports.getPath = getPath;
    function hasUndefined(obj) {
      if (obj === void 0) {
        return true;
      }
      if (obj) {
        if (Array.isArray(obj)) {
          for (var i_1 = 0, len = obj.length; i_1 < len; i_1++) {
            if (hasUndefined(obj[i_1])) {
              return true;
            }
          }
        } else if (typeof obj === "object") {
          var objKeys = _objectKeys(obj);
          var objKeysLength = objKeys.length;
          for (var i = 0; i < objKeysLength; i++) {
            if (hasUndefined(obj[objKeys[i]])) {
              return true;
            }
          }
        }
      }
      return false;
    }
    exports.hasUndefined = hasUndefined;
    function patchErrorMessageFormatter(message, args) {
      var messageParts = [message];
      for (var key in args) {
        var value = typeof args[key] === "object" ? JSON.stringify(args[key], null, 2) : args[key];
        if (typeof value !== "undefined") {
          messageParts.push(key + ": " + value);
        }
      }
      return messageParts.join("\n");
    }
    var PatchError = (
      /** @class */
      (function(_super) {
        __extends(PatchError2, _super);
        function PatchError2(message, name, index, operation, tree) {
          var _newTarget = this.constructor;
          var _this = _super.call(this, patchErrorMessageFormatter(message, { name, index, operation, tree })) || this;
          _this.name = name;
          _this.index = index;
          _this.operation = operation;
          _this.tree = tree;
          Object.setPrototypeOf(_this, _newTarget.prototype);
          _this.message = patchErrorMessageFormatter(message, { name, index, operation, tree });
          return _this;
        }
        return PatchError2;
      })(Error)
    );
    exports.PatchError = PatchError;
  }
});

// node_modules/.pnpm/fast-json-patch@3.1.1/node_modules/fast-json-patch/commonjs/core.js
var require_core = __commonJS({
  "node_modules/.pnpm/fast-json-patch@3.1.1/node_modules/fast-json-patch/commonjs/core.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    var helpers_js_1 = require_helpers();
    exports.JsonPatchError = helpers_js_1.PatchError;
    exports.deepClone = helpers_js_1._deepClone;
    var objOps = {
      add: function(obj, key, document) {
        obj[key] = this.value;
        return { newDocument: document };
      },
      remove: function(obj, key, document) {
        var removed = obj[key];
        delete obj[key];
        return { newDocument: document, removed };
      },
      replace: function(obj, key, document) {
        var removed = obj[key];
        obj[key] = this.value;
        return { newDocument: document, removed };
      },
      move: function(obj, key, document) {
        var removed = getValueByPointer(document, this.path);
        if (removed) {
          removed = helpers_js_1._deepClone(removed);
        }
        var originalValue = applyOperation(document, { op: "remove", path: this.from }).removed;
        applyOperation(document, { op: "add", path: this.path, value: originalValue });
        return { newDocument: document, removed };
      },
      copy: function(obj, key, document) {
        var valueToCopy = getValueByPointer(document, this.from);
        applyOperation(document, { op: "add", path: this.path, value: helpers_js_1._deepClone(valueToCopy) });
        return { newDocument: document };
      },
      test: function(obj, key, document) {
        return { newDocument: document, test: _areEquals(obj[key], this.value) };
      },
      _get: function(obj, key, document) {
        this.value = obj[key];
        return { newDocument: document };
      }
    };
    var arrOps = {
      add: function(arr, i, document) {
        if (helpers_js_1.isInteger(i)) {
          arr.splice(i, 0, this.value);
        } else {
          arr[i] = this.value;
        }
        return { newDocument: document, index: i };
      },
      remove: function(arr, i, document) {
        var removedList = arr.splice(i, 1);
        return { newDocument: document, removed: removedList[0] };
      },
      replace: function(arr, i, document) {
        var removed = arr[i];
        arr[i] = this.value;
        return { newDocument: document, removed };
      },
      move: objOps.move,
      copy: objOps.copy,
      test: objOps.test,
      _get: objOps._get
    };
    function getValueByPointer(document, pointer) {
      if (pointer == "") {
        return document;
      }
      var getOriginalDestination = { op: "_get", path: pointer };
      applyOperation(document, getOriginalDestination);
      return getOriginalDestination.value;
    }
    exports.getValueByPointer = getValueByPointer;
    function applyOperation(document, operation, validateOperation, mutateDocument, banPrototypeModifications, index) {
      if (validateOperation === void 0) {
        validateOperation = false;
      }
      if (mutateDocument === void 0) {
        mutateDocument = true;
      }
      if (banPrototypeModifications === void 0) {
        banPrototypeModifications = true;
      }
      if (index === void 0) {
        index = 0;
      }
      if (validateOperation) {
        if (typeof validateOperation == "function") {
          validateOperation(operation, 0, document, operation.path);
        } else {
          validator(operation, 0);
        }
      }
      if (operation.path === "") {
        var returnValue = { newDocument: document };
        if (operation.op === "add") {
          returnValue.newDocument = operation.value;
          return returnValue;
        } else if (operation.op === "replace") {
          returnValue.newDocument = operation.value;
          returnValue.removed = document;
          return returnValue;
        } else if (operation.op === "move" || operation.op === "copy") {
          returnValue.newDocument = getValueByPointer(document, operation.from);
          if (operation.op === "move") {
            returnValue.removed = document;
          }
          return returnValue;
        } else if (operation.op === "test") {
          returnValue.test = _areEquals(document, operation.value);
          if (returnValue.test === false) {
            throw new exports.JsonPatchError("Test operation failed", "TEST_OPERATION_FAILED", index, operation, document);
          }
          returnValue.newDocument = document;
          return returnValue;
        } else if (operation.op === "remove") {
          returnValue.removed = document;
          returnValue.newDocument = null;
          return returnValue;
        } else if (operation.op === "_get") {
          operation.value = document;
          return returnValue;
        } else {
          if (validateOperation) {
            throw new exports.JsonPatchError("Operation `op` property is not one of operations defined in RFC-6902", "OPERATION_OP_INVALID", index, operation, document);
          } else {
            return returnValue;
          }
        }
      } else {
        if (!mutateDocument) {
          document = helpers_js_1._deepClone(document);
        }
        var path = operation.path || "";
        var keys = path.split("/");
        var obj = document;
        var t = 1;
        var len = keys.length;
        var existingPathFragment = void 0;
        var key = void 0;
        var validateFunction = void 0;
        if (typeof validateOperation == "function") {
          validateFunction = validateOperation;
        } else {
          validateFunction = validator;
        }
        while (true) {
          key = keys[t];
          if (key && key.indexOf("~") != -1) {
            key = helpers_js_1.unescapePathComponent(key);
          }
          if (banPrototypeModifications && (key == "__proto__" || key == "prototype" && t > 0 && keys[t - 1] == "constructor")) {
            throw new TypeError("JSON-Patch: modifying `__proto__` or `constructor/prototype` prop is banned for security reasons, if this was on purpose, please set `banPrototypeModifications` flag false and pass it to this function. More info in fast-json-patch README");
          }
          if (validateOperation) {
            if (existingPathFragment === void 0) {
              if (obj[key] === void 0) {
                existingPathFragment = keys.slice(0, t).join("/");
              } else if (t == len - 1) {
                existingPathFragment = operation.path;
              }
              if (existingPathFragment !== void 0) {
                validateFunction(operation, 0, document, existingPathFragment);
              }
            }
          }
          t++;
          if (Array.isArray(obj)) {
            if (key === "-") {
              key = obj.length;
            } else {
              if (validateOperation && !helpers_js_1.isInteger(key)) {
                throw new exports.JsonPatchError("Expected an unsigned base-10 integer value, making the new referenced value the array element with the zero-based index", "OPERATION_PATH_ILLEGAL_ARRAY_INDEX", index, operation, document);
              } else if (helpers_js_1.isInteger(key)) {
                key = ~~key;
              }
            }
            if (t >= len) {
              if (validateOperation && operation.op === "add" && key > obj.length) {
                throw new exports.JsonPatchError("The specified index MUST NOT be greater than the number of elements in the array", "OPERATION_VALUE_OUT_OF_BOUNDS", index, operation, document);
              }
              var returnValue = arrOps[operation.op].call(operation, obj, key, document);
              if (returnValue.test === false) {
                throw new exports.JsonPatchError("Test operation failed", "TEST_OPERATION_FAILED", index, operation, document);
              }
              return returnValue;
            }
          } else {
            if (t >= len) {
              var returnValue = objOps[operation.op].call(operation, obj, key, document);
              if (returnValue.test === false) {
                throw new exports.JsonPatchError("Test operation failed", "TEST_OPERATION_FAILED", index, operation, document);
              }
              return returnValue;
            }
          }
          obj = obj[key];
          if (validateOperation && t < len && (!obj || typeof obj !== "object")) {
            throw new exports.JsonPatchError("Cannot perform operation at the desired path", "OPERATION_PATH_UNRESOLVABLE", index, operation, document);
          }
        }
      }
    }
    exports.applyOperation = applyOperation;
    function applyPatch(document, patch, validateOperation, mutateDocument, banPrototypeModifications) {
      if (mutateDocument === void 0) {
        mutateDocument = true;
      }
      if (banPrototypeModifications === void 0) {
        banPrototypeModifications = true;
      }
      if (validateOperation) {
        if (!Array.isArray(patch)) {
          throw new exports.JsonPatchError("Patch sequence must be an array", "SEQUENCE_NOT_AN_ARRAY");
        }
      }
      if (!mutateDocument) {
        document = helpers_js_1._deepClone(document);
      }
      var results = new Array(patch.length);
      for (var i = 0, length_1 = patch.length; i < length_1; i++) {
        results[i] = applyOperation(document, patch[i], validateOperation, true, banPrototypeModifications, i);
        document = results[i].newDocument;
      }
      results.newDocument = document;
      return results;
    }
    exports.applyPatch = applyPatch;
    function applyReducer(document, operation, index) {
      var operationResult = applyOperation(document, operation);
      if (operationResult.test === false) {
        throw new exports.JsonPatchError("Test operation failed", "TEST_OPERATION_FAILED", index, operation, document);
      }
      return operationResult.newDocument;
    }
    exports.applyReducer = applyReducer;
    function validator(operation, index, document, existingPathFragment) {
      if (typeof operation !== "object" || operation === null || Array.isArray(operation)) {
        throw new exports.JsonPatchError("Operation is not an object", "OPERATION_NOT_AN_OBJECT", index, operation, document);
      } else if (!objOps[operation.op]) {
        throw new exports.JsonPatchError("Operation `op` property is not one of operations defined in RFC-6902", "OPERATION_OP_INVALID", index, operation, document);
      } else if (typeof operation.path !== "string") {
        throw new exports.JsonPatchError("Operation `path` property is not a string", "OPERATION_PATH_INVALID", index, operation, document);
      } else if (operation.path.indexOf("/") !== 0 && operation.path.length > 0) {
        throw new exports.JsonPatchError('Operation `path` property must start with "/"', "OPERATION_PATH_INVALID", index, operation, document);
      } else if ((operation.op === "move" || operation.op === "copy") && typeof operation.from !== "string") {
        throw new exports.JsonPatchError("Operation `from` property is not present (applicable in `move` and `copy` operations)", "OPERATION_FROM_REQUIRED", index, operation, document);
      } else if ((operation.op === "add" || operation.op === "replace" || operation.op === "test") && operation.value === void 0) {
        throw new exports.JsonPatchError("Operation `value` property is not present (applicable in `add`, `replace` and `test` operations)", "OPERATION_VALUE_REQUIRED", index, operation, document);
      } else if ((operation.op === "add" || operation.op === "replace" || operation.op === "test") && helpers_js_1.hasUndefined(operation.value)) {
        throw new exports.JsonPatchError("Operation `value` property is not present (applicable in `add`, `replace` and `test` operations)", "OPERATION_VALUE_CANNOT_CONTAIN_UNDEFINED", index, operation, document);
      } else if (document) {
        if (operation.op == "add") {
          var pathLen = operation.path.split("/").length;
          var existingPathLen = existingPathFragment.split("/").length;
          if (pathLen !== existingPathLen + 1 && pathLen !== existingPathLen) {
            throw new exports.JsonPatchError("Cannot perform an `add` operation at the desired path", "OPERATION_PATH_CANNOT_ADD", index, operation, document);
          }
        } else if (operation.op === "replace" || operation.op === "remove" || operation.op === "_get") {
          if (operation.path !== existingPathFragment) {
            throw new exports.JsonPatchError("Cannot perform the operation at a path that does not exist", "OPERATION_PATH_UNRESOLVABLE", index, operation, document);
          }
        } else if (operation.op === "move" || operation.op === "copy") {
          var existingValue = { op: "_get", path: operation.from, value: void 0 };
          var error = validate([existingValue], document);
          if (error && error.name === "OPERATION_PATH_UNRESOLVABLE") {
            throw new exports.JsonPatchError("Cannot perform the operation from a path that does not exist", "OPERATION_FROM_UNRESOLVABLE", index, operation, document);
          }
        }
      }
    }
    exports.validator = validator;
    function validate(sequence, document, externalValidator) {
      try {
        if (!Array.isArray(sequence)) {
          throw new exports.JsonPatchError("Patch sequence must be an array", "SEQUENCE_NOT_AN_ARRAY");
        }
        if (document) {
          applyPatch(helpers_js_1._deepClone(document), helpers_js_1._deepClone(sequence), externalValidator || true);
        } else {
          externalValidator = externalValidator || validator;
          for (var i = 0; i < sequence.length; i++) {
            externalValidator(sequence[i], i, document, void 0);
          }
        }
      } catch (e) {
        if (e instanceof exports.JsonPatchError) {
          return e;
        } else {
          throw e;
        }
      }
    }
    exports.validate = validate;
    function _areEquals(a2, b2) {
      if (a2 === b2)
        return true;
      if (a2 && b2 && typeof a2 == "object" && typeof b2 == "object") {
        var arrA = Array.isArray(a2), arrB = Array.isArray(b2), i, length, key;
        if (arrA && arrB) {
          length = a2.length;
          if (length != b2.length)
            return false;
          for (i = length; i-- !== 0; )
            if (!_areEquals(a2[i], b2[i]))
              return false;
          return true;
        }
        if (arrA != arrB)
          return false;
        var keys = Object.keys(a2);
        length = keys.length;
        if (length !== Object.keys(b2).length)
          return false;
        for (i = length; i-- !== 0; )
          if (!b2.hasOwnProperty(keys[i]))
            return false;
        for (i = length; i-- !== 0; ) {
          key = keys[i];
          if (!_areEquals(a2[key], b2[key]))
            return false;
        }
        return true;
      }
      return a2 !== a2 && b2 !== b2;
    }
    exports._areEquals = _areEquals;
  }
});

// node_modules/.pnpm/fast-json-patch@3.1.1/node_modules/fast-json-patch/commonjs/duplex.js
var require_duplex = __commonJS({
  "node_modules/.pnpm/fast-json-patch@3.1.1/node_modules/fast-json-patch/commonjs/duplex.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    var helpers_js_1 = require_helpers();
    var core_js_1 = require_core();
    var beforeDict = /* @__PURE__ */ new WeakMap();
    var Mirror = (
      /** @class */
      /* @__PURE__ */ (function() {
        function Mirror2(obj) {
          this.observers = /* @__PURE__ */ new Map();
          this.obj = obj;
        }
        return Mirror2;
      })()
    );
    var ObserverInfo = (
      /** @class */
      /* @__PURE__ */ (function() {
        function ObserverInfo2(callback, observer) {
          this.callback = callback;
          this.observer = observer;
        }
        return ObserverInfo2;
      })()
    );
    function getMirror(obj) {
      return beforeDict.get(obj);
    }
    function getObserverFromMirror(mirror, callback) {
      return mirror.observers.get(callback);
    }
    function removeObserverFromMirror(mirror, observer) {
      mirror.observers.delete(observer.callback);
    }
    function unobserve(root, observer) {
      observer.unobserve();
    }
    exports.unobserve = unobserve;
    function observe(obj, callback) {
      var patches = [];
      var observer;
      var mirror = getMirror(obj);
      if (!mirror) {
        mirror = new Mirror(obj);
        beforeDict.set(obj, mirror);
      } else {
        var observerInfo = getObserverFromMirror(mirror, callback);
        observer = observerInfo && observerInfo.observer;
      }
      if (observer) {
        return observer;
      }
      observer = {};
      mirror.value = helpers_js_1._deepClone(obj);
      if (callback) {
        observer.callback = callback;
        observer.next = null;
        var dirtyCheck = function() {
          generate(observer);
        };
        var fastCheck = function() {
          clearTimeout(observer.next);
          observer.next = setTimeout(dirtyCheck);
        };
        if (typeof window !== "undefined") {
          window.addEventListener("mouseup", fastCheck);
          window.addEventListener("keyup", fastCheck);
          window.addEventListener("mousedown", fastCheck);
          window.addEventListener("keydown", fastCheck);
          window.addEventListener("change", fastCheck);
        }
      }
      observer.patches = patches;
      observer.object = obj;
      observer.unobserve = function() {
        generate(observer);
        clearTimeout(observer.next);
        removeObserverFromMirror(mirror, observer);
        if (typeof window !== "undefined") {
          window.removeEventListener("mouseup", fastCheck);
          window.removeEventListener("keyup", fastCheck);
          window.removeEventListener("mousedown", fastCheck);
          window.removeEventListener("keydown", fastCheck);
          window.removeEventListener("change", fastCheck);
        }
      };
      mirror.observers.set(callback, new ObserverInfo(callback, observer));
      return observer;
    }
    exports.observe = observe;
    function generate(observer, invertible) {
      if (invertible === void 0) {
        invertible = false;
      }
      var mirror = beforeDict.get(observer.object);
      _generate(mirror.value, observer.object, observer.patches, "", invertible);
      if (observer.patches.length) {
        core_js_1.applyPatch(mirror.value, observer.patches);
      }
      var temp = observer.patches;
      if (temp.length > 0) {
        observer.patches = [];
        if (observer.callback) {
          observer.callback(temp);
        }
      }
      return temp;
    }
    exports.generate = generate;
    function _generate(mirror, obj, patches, path, invertible) {
      if (obj === mirror) {
        return;
      }
      if (typeof obj.toJSON === "function") {
        obj = obj.toJSON();
      }
      var newKeys = helpers_js_1._objectKeys(obj);
      var oldKeys = helpers_js_1._objectKeys(mirror);
      var changed = false;
      var deleted = false;
      for (var t = oldKeys.length - 1; t >= 0; t--) {
        var key = oldKeys[t];
        var oldVal = mirror[key];
        if (helpers_js_1.hasOwnProperty(obj, key) && !(obj[key] === void 0 && oldVal !== void 0 && Array.isArray(obj) === false)) {
          var newVal = obj[key];
          if (typeof oldVal == "object" && oldVal != null && typeof newVal == "object" && newVal != null && Array.isArray(oldVal) === Array.isArray(newVal)) {
            _generate(oldVal, newVal, patches, path + "/" + helpers_js_1.escapePathComponent(key), invertible);
          } else {
            if (oldVal !== newVal) {
              changed = true;
              if (invertible) {
                patches.push({ op: "test", path: path + "/" + helpers_js_1.escapePathComponent(key), value: helpers_js_1._deepClone(oldVal) });
              }
              patches.push({ op: "replace", path: path + "/" + helpers_js_1.escapePathComponent(key), value: helpers_js_1._deepClone(newVal) });
            }
          }
        } else if (Array.isArray(mirror) === Array.isArray(obj)) {
          if (invertible) {
            patches.push({ op: "test", path: path + "/" + helpers_js_1.escapePathComponent(key), value: helpers_js_1._deepClone(oldVal) });
          }
          patches.push({ op: "remove", path: path + "/" + helpers_js_1.escapePathComponent(key) });
          deleted = true;
        } else {
          if (invertible) {
            patches.push({ op: "test", path, value: mirror });
          }
          patches.push({ op: "replace", path, value: obj });
          changed = true;
        }
      }
      if (!deleted && newKeys.length == oldKeys.length) {
        return;
      }
      for (var t = 0; t < newKeys.length; t++) {
        var key = newKeys[t];
        if (!helpers_js_1.hasOwnProperty(mirror, key) && obj[key] !== void 0) {
          patches.push({ op: "add", path: path + "/" + helpers_js_1.escapePathComponent(key), value: helpers_js_1._deepClone(obj[key]) });
        }
      }
    }
    function compare(tree1, tree2, invertible) {
      if (invertible === void 0) {
        invertible = false;
      }
      var patches = [];
      _generate(tree1, tree2, patches, "", invertible);
      return patches;
    }
    exports.compare = compare;
  }
});

// node_modules/.pnpm/fast-json-patch@3.1.1/node_modules/fast-json-patch/index.js
var require_fast_json_patch = __commonJS({
  "node_modules/.pnpm/fast-json-patch@3.1.1/node_modules/fast-json-patch/index.js"(exports) {
    var core = require_core();
    Object.assign(exports, core);
    var duplex = require_duplex();
    Object.assign(exports, duplex);
    var helpers = require_helpers();
    exports.JsonPatchError = helpers.PatchError;
    exports.deepClone = helpers._deepClone;
    exports.escapePathComponent = helpers.escapePathComponent;
    exports.unescapePathComponent = helpers.unescapePathComponent;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isFunction.js
var require_isFunction = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isFunction.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isFunction = void 0;
    function isFunction(value) {
      return typeof value === "function";
    }
    exports.isFunction = isFunction;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/createErrorClass.js
var require_createErrorClass = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/createErrorClass.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createErrorClass = void 0;
    function createErrorClass(createImpl) {
      var _super = function(instance) {
        Error.call(instance);
        instance.stack = new Error().stack;
      };
      var ctorFunc = createImpl(_super);
      ctorFunc.prototype = Object.create(Error.prototype);
      ctorFunc.prototype.constructor = ctorFunc;
      return ctorFunc;
    }
    exports.createErrorClass = createErrorClass;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/UnsubscriptionError.js
var require_UnsubscriptionError = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/UnsubscriptionError.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.UnsubscriptionError = void 0;
    var createErrorClass_1 = require_createErrorClass();
    exports.UnsubscriptionError = createErrorClass_1.createErrorClass(function(_super) {
      return function UnsubscriptionErrorImpl(errors) {
        _super(this);
        this.message = errors ? errors.length + " errors occurred during unsubscription:\n" + errors.map(function(err, i) {
          return i + 1 + ") " + err.toString();
        }).join("\n  ") : "";
        this.name = "UnsubscriptionError";
        this.errors = errors;
      };
    });
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/arrRemove.js
var require_arrRemove = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/arrRemove.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.arrRemove = void 0;
    function arrRemove(arr, item) {
      if (arr) {
        var index = arr.indexOf(item);
        0 <= index && arr.splice(index, 1);
      }
    }
    exports.arrRemove = arrRemove;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/Subscription.js
var require_Subscription = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/Subscription.js"(exports) {
    "use strict";
    var __values = exports && exports.__values || function(o2) {
      var s2 = typeof Symbol === "function" && Symbol.iterator, m2 = s2 && o2[s2], i = 0;
      if (m2) return m2.call(o2);
      if (o2 && typeof o2.length === "number") return {
        next: function() {
          if (o2 && i >= o2.length) o2 = void 0;
          return { value: o2 && o2[i++], done: !o2 };
        }
      };
      throw new TypeError(s2 ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isSubscription = exports.EMPTY_SUBSCRIPTION = exports.Subscription = void 0;
    var isFunction_1 = require_isFunction();
    var UnsubscriptionError_1 = require_UnsubscriptionError();
    var arrRemove_1 = require_arrRemove();
    var Subscription = (function() {
      function Subscription2(initialTeardown) {
        this.initialTeardown = initialTeardown;
        this.closed = false;
        this._parentage = null;
        this._finalizers = null;
      }
      Subscription2.prototype.unsubscribe = function() {
        var e_1, _a, e_2, _b;
        var errors;
        if (!this.closed) {
          this.closed = true;
          var _parentage = this._parentage;
          if (_parentage) {
            this._parentage = null;
            if (Array.isArray(_parentage)) {
              try {
                for (var _parentage_1 = __values(_parentage), _parentage_1_1 = _parentage_1.next(); !_parentage_1_1.done; _parentage_1_1 = _parentage_1.next()) {
                  var parent_1 = _parentage_1_1.value;
                  parent_1.remove(this);
                }
              } catch (e_1_1) {
                e_1 = { error: e_1_1 };
              } finally {
                try {
                  if (_parentage_1_1 && !_parentage_1_1.done && (_a = _parentage_1.return)) _a.call(_parentage_1);
                } finally {
                  if (e_1) throw e_1.error;
                }
              }
            } else {
              _parentage.remove(this);
            }
          }
          var initialFinalizer = this.initialTeardown;
          if (isFunction_1.isFunction(initialFinalizer)) {
            try {
              initialFinalizer();
            } catch (e) {
              errors = e instanceof UnsubscriptionError_1.UnsubscriptionError ? e.errors : [e];
            }
          }
          var _finalizers = this._finalizers;
          if (_finalizers) {
            this._finalizers = null;
            try {
              for (var _finalizers_1 = __values(_finalizers), _finalizers_1_1 = _finalizers_1.next(); !_finalizers_1_1.done; _finalizers_1_1 = _finalizers_1.next()) {
                var finalizer = _finalizers_1_1.value;
                try {
                  execFinalizer(finalizer);
                } catch (err) {
                  errors = errors !== null && errors !== void 0 ? errors : [];
                  if (err instanceof UnsubscriptionError_1.UnsubscriptionError) {
                    errors = __spreadArray(__spreadArray([], __read(errors)), __read(err.errors));
                  } else {
                    errors.push(err);
                  }
                }
              }
            } catch (e_2_1) {
              e_2 = { error: e_2_1 };
            } finally {
              try {
                if (_finalizers_1_1 && !_finalizers_1_1.done && (_b = _finalizers_1.return)) _b.call(_finalizers_1);
              } finally {
                if (e_2) throw e_2.error;
              }
            }
          }
          if (errors) {
            throw new UnsubscriptionError_1.UnsubscriptionError(errors);
          }
        }
      };
      Subscription2.prototype.add = function(teardown) {
        var _a;
        if (teardown && teardown !== this) {
          if (this.closed) {
            execFinalizer(teardown);
          } else {
            if (teardown instanceof Subscription2) {
              if (teardown.closed || teardown._hasParent(this)) {
                return;
              }
              teardown._addParent(this);
            }
            (this._finalizers = (_a = this._finalizers) !== null && _a !== void 0 ? _a : []).push(teardown);
          }
        }
      };
      Subscription2.prototype._hasParent = function(parent) {
        var _parentage = this._parentage;
        return _parentage === parent || Array.isArray(_parentage) && _parentage.includes(parent);
      };
      Subscription2.prototype._addParent = function(parent) {
        var _parentage = this._parentage;
        this._parentage = Array.isArray(_parentage) ? (_parentage.push(parent), _parentage) : _parentage ? [_parentage, parent] : parent;
      };
      Subscription2.prototype._removeParent = function(parent) {
        var _parentage = this._parentage;
        if (_parentage === parent) {
          this._parentage = null;
        } else if (Array.isArray(_parentage)) {
          arrRemove_1.arrRemove(_parentage, parent);
        }
      };
      Subscription2.prototype.remove = function(teardown) {
        var _finalizers = this._finalizers;
        _finalizers && arrRemove_1.arrRemove(_finalizers, teardown);
        if (teardown instanceof Subscription2) {
          teardown._removeParent(this);
        }
      };
      Subscription2.EMPTY = (function() {
        var empty = new Subscription2();
        empty.closed = true;
        return empty;
      })();
      return Subscription2;
    })();
    exports.Subscription = Subscription;
    exports.EMPTY_SUBSCRIPTION = Subscription.EMPTY;
    function isSubscription(value) {
      return value instanceof Subscription || value && "closed" in value && isFunction_1.isFunction(value.remove) && isFunction_1.isFunction(value.add) && isFunction_1.isFunction(value.unsubscribe);
    }
    exports.isSubscription = isSubscription;
    function execFinalizer(finalizer) {
      if (isFunction_1.isFunction(finalizer)) {
        finalizer();
      } else {
        finalizer.unsubscribe();
      }
    }
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/config.js
var require_config = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/config.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.config = void 0;
    exports.config = {
      onUnhandledError: null,
      onStoppedNotification: null,
      Promise: void 0,
      useDeprecatedSynchronousErrorHandling: false,
      useDeprecatedNextContext: false
    };
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/timeoutProvider.js
var require_timeoutProvider = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/timeoutProvider.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.timeoutProvider = void 0;
    exports.timeoutProvider = {
      setTimeout: function(handler, timeout) {
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
          args[_i - 2] = arguments[_i];
        }
        var delegate = exports.timeoutProvider.delegate;
        if (delegate === null || delegate === void 0 ? void 0 : delegate.setTimeout) {
          return delegate.setTimeout.apply(delegate, __spreadArray([handler, timeout], __read(args)));
        }
        return setTimeout.apply(void 0, __spreadArray([handler, timeout], __read(args)));
      },
      clearTimeout: function(handle) {
        var delegate = exports.timeoutProvider.delegate;
        return ((delegate === null || delegate === void 0 ? void 0 : delegate.clearTimeout) || clearTimeout)(handle);
      },
      delegate: void 0
    };
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/reportUnhandledError.js
var require_reportUnhandledError = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/reportUnhandledError.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.reportUnhandledError = void 0;
    var config_1 = require_config();
    var timeoutProvider_1 = require_timeoutProvider();
    function reportUnhandledError(err) {
      timeoutProvider_1.timeoutProvider.setTimeout(function() {
        var onUnhandledError = config_1.config.onUnhandledError;
        if (onUnhandledError) {
          onUnhandledError(err);
        } else {
          throw err;
        }
      });
    }
    exports.reportUnhandledError = reportUnhandledError;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/noop.js
var require_noop = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/noop.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.noop = void 0;
    function noop() {
    }
    exports.noop = noop;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/NotificationFactories.js
var require_NotificationFactories = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/NotificationFactories.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createNotification = exports.nextNotification = exports.errorNotification = exports.COMPLETE_NOTIFICATION = void 0;
    exports.COMPLETE_NOTIFICATION = (function() {
      return createNotification("C", void 0, void 0);
    })();
    function errorNotification(error) {
      return createNotification("E", void 0, error);
    }
    exports.errorNotification = errorNotification;
    function nextNotification(value) {
      return createNotification("N", value, void 0);
    }
    exports.nextNotification = nextNotification;
    function createNotification(kind, value, error) {
      return {
        kind,
        value,
        error
      };
    }
    exports.createNotification = createNotification;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/errorContext.js
var require_errorContext = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/errorContext.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.captureError = exports.errorContext = void 0;
    var config_1 = require_config();
    var context = null;
    function errorContext(cb) {
      if (config_1.config.useDeprecatedSynchronousErrorHandling) {
        var isRoot = !context;
        if (isRoot) {
          context = { errorThrown: false, error: null };
        }
        cb();
        if (isRoot) {
          var _a = context, errorThrown = _a.errorThrown, error = _a.error;
          context = null;
          if (errorThrown) {
            throw error;
          }
        }
      } else {
        cb();
      }
    }
    exports.errorContext = errorContext;
    function captureError(err) {
      if (config_1.config.useDeprecatedSynchronousErrorHandling && context) {
        context.errorThrown = true;
        context.error = err;
      }
    }
    exports.captureError = captureError;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/Subscriber.js
var require_Subscriber = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/Subscriber.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d2, b2) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
          d3.__proto__ = b3;
        } || function(d3, b3) {
          for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
        };
        return extendStatics(d2, b2);
      };
      return function(d2, b2) {
        if (typeof b2 !== "function" && b2 !== null)
          throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
        extendStatics(d2, b2);
        function __() {
          this.constructor = d2;
        }
        d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EMPTY_OBSERVER = exports.SafeSubscriber = exports.Subscriber = void 0;
    var isFunction_1 = require_isFunction();
    var Subscription_1 = require_Subscription();
    var config_1 = require_config();
    var reportUnhandledError_1 = require_reportUnhandledError();
    var noop_1 = require_noop();
    var NotificationFactories_1 = require_NotificationFactories();
    var timeoutProvider_1 = require_timeoutProvider();
    var errorContext_1 = require_errorContext();
    var Subscriber = (function(_super) {
      __extends(Subscriber2, _super);
      function Subscriber2(destination) {
        var _this = _super.call(this) || this;
        _this.isStopped = false;
        if (destination) {
          _this.destination = destination;
          if (Subscription_1.isSubscription(destination)) {
            destination.add(_this);
          }
        } else {
          _this.destination = exports.EMPTY_OBSERVER;
        }
        return _this;
      }
      Subscriber2.create = function(next, error, complete) {
        return new SafeSubscriber(next, error, complete);
      };
      Subscriber2.prototype.next = function(value) {
        if (this.isStopped) {
          handleStoppedNotification(NotificationFactories_1.nextNotification(value), this);
        } else {
          this._next(value);
        }
      };
      Subscriber2.prototype.error = function(err) {
        if (this.isStopped) {
          handleStoppedNotification(NotificationFactories_1.errorNotification(err), this);
        } else {
          this.isStopped = true;
          this._error(err);
        }
      };
      Subscriber2.prototype.complete = function() {
        if (this.isStopped) {
          handleStoppedNotification(NotificationFactories_1.COMPLETE_NOTIFICATION, this);
        } else {
          this.isStopped = true;
          this._complete();
        }
      };
      Subscriber2.prototype.unsubscribe = function() {
        if (!this.closed) {
          this.isStopped = true;
          _super.prototype.unsubscribe.call(this);
          this.destination = null;
        }
      };
      Subscriber2.prototype._next = function(value) {
        this.destination.next(value);
      };
      Subscriber2.prototype._error = function(err) {
        try {
          this.destination.error(err);
        } finally {
          this.unsubscribe();
        }
      };
      Subscriber2.prototype._complete = function() {
        try {
          this.destination.complete();
        } finally {
          this.unsubscribe();
        }
      };
      return Subscriber2;
    })(Subscription_1.Subscription);
    exports.Subscriber = Subscriber;
    var _bind = Function.prototype.bind;
    function bind(fn, thisArg) {
      return _bind.call(fn, thisArg);
    }
    var ConsumerObserver = (function() {
      function ConsumerObserver2(partialObserver) {
        this.partialObserver = partialObserver;
      }
      ConsumerObserver2.prototype.next = function(value) {
        var partialObserver = this.partialObserver;
        if (partialObserver.next) {
          try {
            partialObserver.next(value);
          } catch (error) {
            handleUnhandledError(error);
          }
        }
      };
      ConsumerObserver2.prototype.error = function(err) {
        var partialObserver = this.partialObserver;
        if (partialObserver.error) {
          try {
            partialObserver.error(err);
          } catch (error) {
            handleUnhandledError(error);
          }
        } else {
          handleUnhandledError(err);
        }
      };
      ConsumerObserver2.prototype.complete = function() {
        var partialObserver = this.partialObserver;
        if (partialObserver.complete) {
          try {
            partialObserver.complete();
          } catch (error) {
            handleUnhandledError(error);
          }
        }
      };
      return ConsumerObserver2;
    })();
    var SafeSubscriber = (function(_super) {
      __extends(SafeSubscriber2, _super);
      function SafeSubscriber2(observerOrNext, error, complete) {
        var _this = _super.call(this) || this;
        var partialObserver;
        if (isFunction_1.isFunction(observerOrNext) || !observerOrNext) {
          partialObserver = {
            next: observerOrNext !== null && observerOrNext !== void 0 ? observerOrNext : void 0,
            error: error !== null && error !== void 0 ? error : void 0,
            complete: complete !== null && complete !== void 0 ? complete : void 0
          };
        } else {
          var context_1;
          if (_this && config_1.config.useDeprecatedNextContext) {
            context_1 = Object.create(observerOrNext);
            context_1.unsubscribe = function() {
              return _this.unsubscribe();
            };
            partialObserver = {
              next: observerOrNext.next && bind(observerOrNext.next, context_1),
              error: observerOrNext.error && bind(observerOrNext.error, context_1),
              complete: observerOrNext.complete && bind(observerOrNext.complete, context_1)
            };
          } else {
            partialObserver = observerOrNext;
          }
        }
        _this.destination = new ConsumerObserver(partialObserver);
        return _this;
      }
      return SafeSubscriber2;
    })(Subscriber);
    exports.SafeSubscriber = SafeSubscriber;
    function handleUnhandledError(error) {
      if (config_1.config.useDeprecatedSynchronousErrorHandling) {
        errorContext_1.captureError(error);
      } else {
        reportUnhandledError_1.reportUnhandledError(error);
      }
    }
    function defaultErrorHandler(err) {
      throw err;
    }
    function handleStoppedNotification(notification, subscriber) {
      var onStoppedNotification = config_1.config.onStoppedNotification;
      onStoppedNotification && timeoutProvider_1.timeoutProvider.setTimeout(function() {
        return onStoppedNotification(notification, subscriber);
      });
    }
    exports.EMPTY_OBSERVER = {
      closed: true,
      next: noop_1.noop,
      error: defaultErrorHandler,
      complete: noop_1.noop
    };
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/symbol/observable.js
var require_observable = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/symbol/observable.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.observable = void 0;
    exports.observable = (function() {
      return typeof Symbol === "function" && Symbol.observable || "@@observable";
    })();
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/identity.js
var require_identity = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/identity.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.identity = void 0;
    function identity(x2) {
      return x2;
    }
    exports.identity = identity;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/pipe.js
var require_pipe = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/pipe.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.pipeFromArray = exports.pipe = void 0;
    var identity_1 = require_identity();
    function pipe() {
      var fns = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        fns[_i] = arguments[_i];
      }
      return pipeFromArray(fns);
    }
    exports.pipe = pipe;
    function pipeFromArray(fns) {
      if (fns.length === 0) {
        return identity_1.identity;
      }
      if (fns.length === 1) {
        return fns[0];
      }
      return function piped(input) {
        return fns.reduce(function(prev, fn) {
          return fn(prev);
        }, input);
      };
    }
    exports.pipeFromArray = pipeFromArray;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/Observable.js
var require_Observable = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/Observable.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Observable = void 0;
    var Subscriber_1 = require_Subscriber();
    var Subscription_1 = require_Subscription();
    var observable_1 = require_observable();
    var pipe_1 = require_pipe();
    var config_1 = require_config();
    var isFunction_1 = require_isFunction();
    var errorContext_1 = require_errorContext();
    var Observable = (function() {
      function Observable2(subscribe) {
        if (subscribe) {
          this._subscribe = subscribe;
        }
      }
      Observable2.prototype.lift = function(operator) {
        var observable = new Observable2();
        observable.source = this;
        observable.operator = operator;
        return observable;
      };
      Observable2.prototype.subscribe = function(observerOrNext, error, complete) {
        var _this = this;
        var subscriber = isSubscriber(observerOrNext) ? observerOrNext : new Subscriber_1.SafeSubscriber(observerOrNext, error, complete);
        errorContext_1.errorContext(function() {
          var _a = _this, operator = _a.operator, source = _a.source;
          subscriber.add(operator ? operator.call(subscriber, source) : source ? _this._subscribe(subscriber) : _this._trySubscribe(subscriber));
        });
        return subscriber;
      };
      Observable2.prototype._trySubscribe = function(sink) {
        try {
          return this._subscribe(sink);
        } catch (err) {
          sink.error(err);
        }
      };
      Observable2.prototype.forEach = function(next, promiseCtor) {
        var _this = this;
        promiseCtor = getPromiseCtor(promiseCtor);
        return new promiseCtor(function(resolve, reject) {
          var subscriber = new Subscriber_1.SafeSubscriber({
            next: function(value) {
              try {
                next(value);
              } catch (err) {
                reject(err);
                subscriber.unsubscribe();
              }
            },
            error: reject,
            complete: resolve
          });
          _this.subscribe(subscriber);
        });
      };
      Observable2.prototype._subscribe = function(subscriber) {
        var _a;
        return (_a = this.source) === null || _a === void 0 ? void 0 : _a.subscribe(subscriber);
      };
      Observable2.prototype[observable_1.observable] = function() {
        return this;
      };
      Observable2.prototype.pipe = function() {
        var operations = [];
        for (var _i = 0; _i < arguments.length; _i++) {
          operations[_i] = arguments[_i];
        }
        return pipe_1.pipeFromArray(operations)(this);
      };
      Observable2.prototype.toPromise = function(promiseCtor) {
        var _this = this;
        promiseCtor = getPromiseCtor(promiseCtor);
        return new promiseCtor(function(resolve, reject) {
          var value;
          _this.subscribe(function(x2) {
            return value = x2;
          }, function(err) {
            return reject(err);
          }, function() {
            return resolve(value);
          });
        });
      };
      Observable2.create = function(subscribe) {
        return new Observable2(subscribe);
      };
      return Observable2;
    })();
    exports.Observable = Observable;
    function getPromiseCtor(promiseCtor) {
      var _a;
      return (_a = promiseCtor !== null && promiseCtor !== void 0 ? promiseCtor : config_1.config.Promise) !== null && _a !== void 0 ? _a : Promise;
    }
    function isObserver(value) {
      return value && isFunction_1.isFunction(value.next) && isFunction_1.isFunction(value.error) && isFunction_1.isFunction(value.complete);
    }
    function isSubscriber(value) {
      return value && value instanceof Subscriber_1.Subscriber || isObserver(value) && Subscription_1.isSubscription(value);
    }
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/lift.js
var require_lift = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/lift.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.operate = exports.hasLift = void 0;
    var isFunction_1 = require_isFunction();
    function hasLift(source) {
      return isFunction_1.isFunction(source === null || source === void 0 ? void 0 : source.lift);
    }
    exports.hasLift = hasLift;
    function operate(init) {
      return function(source) {
        if (hasLift(source)) {
          return source.lift(function(liftedSource) {
            try {
              return init(liftedSource, this);
            } catch (err) {
              this.error(err);
            }
          });
        }
        throw new TypeError("Unable to lift unknown Observable type");
      };
    }
    exports.operate = operate;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/OperatorSubscriber.js
var require_OperatorSubscriber = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/OperatorSubscriber.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d2, b2) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
          d3.__proto__ = b3;
        } || function(d3, b3) {
          for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
        };
        return extendStatics(d2, b2);
      };
      return function(d2, b2) {
        if (typeof b2 !== "function" && b2 !== null)
          throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
        extendStatics(d2, b2);
        function __() {
          this.constructor = d2;
        }
        d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.OperatorSubscriber = exports.createOperatorSubscriber = void 0;
    var Subscriber_1 = require_Subscriber();
    function createOperatorSubscriber(destination, onNext, onComplete, onError, onFinalize) {
      return new OperatorSubscriber(destination, onNext, onComplete, onError, onFinalize);
    }
    exports.createOperatorSubscriber = createOperatorSubscriber;
    var OperatorSubscriber = (function(_super) {
      __extends(OperatorSubscriber2, _super);
      function OperatorSubscriber2(destination, onNext, onComplete, onError, onFinalize, shouldUnsubscribe) {
        var _this = _super.call(this, destination) || this;
        _this.onFinalize = onFinalize;
        _this.shouldUnsubscribe = shouldUnsubscribe;
        _this._next = onNext ? function(value) {
          try {
            onNext(value);
          } catch (err) {
            destination.error(err);
          }
        } : _super.prototype._next;
        _this._error = onError ? function(err) {
          try {
            onError(err);
          } catch (err2) {
            destination.error(err2);
          } finally {
            this.unsubscribe();
          }
        } : _super.prototype._error;
        _this._complete = onComplete ? function() {
          try {
            onComplete();
          } catch (err) {
            destination.error(err);
          } finally {
            this.unsubscribe();
          }
        } : _super.prototype._complete;
        return _this;
      }
      OperatorSubscriber2.prototype.unsubscribe = function() {
        var _a;
        if (!this.shouldUnsubscribe || this.shouldUnsubscribe()) {
          var closed_1 = this.closed;
          _super.prototype.unsubscribe.call(this);
          !closed_1 && ((_a = this.onFinalize) === null || _a === void 0 ? void 0 : _a.call(this));
        }
      };
      return OperatorSubscriber2;
    })(Subscriber_1.Subscriber);
    exports.OperatorSubscriber = OperatorSubscriber;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/refCount.js
var require_refCount = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/refCount.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.refCount = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function refCount() {
      return lift_1.operate(function(source, subscriber) {
        var connection = null;
        source._refCount++;
        var refCounter = OperatorSubscriber_1.createOperatorSubscriber(subscriber, void 0, void 0, void 0, function() {
          if (!source || source._refCount <= 0 || 0 < --source._refCount) {
            connection = null;
            return;
          }
          var sharedConnection = source._connection;
          var conn = connection;
          connection = null;
          if (sharedConnection && (!conn || sharedConnection === conn)) {
            sharedConnection.unsubscribe();
          }
          subscriber.unsubscribe();
        });
        source.subscribe(refCounter);
        if (!refCounter.closed) {
          connection = source.connect();
        }
      });
    }
    exports.refCount = refCount;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/ConnectableObservable.js
var require_ConnectableObservable = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/ConnectableObservable.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d2, b2) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
          d3.__proto__ = b3;
        } || function(d3, b3) {
          for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
        };
        return extendStatics(d2, b2);
      };
      return function(d2, b2) {
        if (typeof b2 !== "function" && b2 !== null)
          throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
        extendStatics(d2, b2);
        function __() {
          this.constructor = d2;
        }
        d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ConnectableObservable = void 0;
    var Observable_1 = require_Observable();
    var Subscription_1 = require_Subscription();
    var refCount_1 = require_refCount();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var lift_1 = require_lift();
    var ConnectableObservable = (function(_super) {
      __extends(ConnectableObservable2, _super);
      function ConnectableObservable2(source, subjectFactory) {
        var _this = _super.call(this) || this;
        _this.source = source;
        _this.subjectFactory = subjectFactory;
        _this._subject = null;
        _this._refCount = 0;
        _this._connection = null;
        if (lift_1.hasLift(source)) {
          _this.lift = source.lift;
        }
        return _this;
      }
      ConnectableObservable2.prototype._subscribe = function(subscriber) {
        return this.getSubject().subscribe(subscriber);
      };
      ConnectableObservable2.prototype.getSubject = function() {
        var subject = this._subject;
        if (!subject || subject.isStopped) {
          this._subject = this.subjectFactory();
        }
        return this._subject;
      };
      ConnectableObservable2.prototype._teardown = function() {
        this._refCount = 0;
        var _connection = this._connection;
        this._subject = this._connection = null;
        _connection === null || _connection === void 0 ? void 0 : _connection.unsubscribe();
      };
      ConnectableObservable2.prototype.connect = function() {
        var _this = this;
        var connection = this._connection;
        if (!connection) {
          connection = this._connection = new Subscription_1.Subscription();
          var subject_1 = this.getSubject();
          connection.add(this.source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subject_1, void 0, function() {
            _this._teardown();
            subject_1.complete();
          }, function(err) {
            _this._teardown();
            subject_1.error(err);
          }, function() {
            return _this._teardown();
          })));
          if (connection.closed) {
            this._connection = null;
            connection = Subscription_1.Subscription.EMPTY;
          }
        }
        return connection;
      };
      ConnectableObservable2.prototype.refCount = function() {
        return refCount_1.refCount()(this);
      };
      return ConnectableObservable2;
    })(Observable_1.Observable);
    exports.ConnectableObservable = ConnectableObservable;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/performanceTimestampProvider.js
var require_performanceTimestampProvider = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/performanceTimestampProvider.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.performanceTimestampProvider = void 0;
    exports.performanceTimestampProvider = {
      now: function() {
        return (exports.performanceTimestampProvider.delegate || performance).now();
      },
      delegate: void 0
    };
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/animationFrameProvider.js
var require_animationFrameProvider = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/animationFrameProvider.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.animationFrameProvider = void 0;
    var Subscription_1 = require_Subscription();
    exports.animationFrameProvider = {
      schedule: function(callback) {
        var request = requestAnimationFrame;
        var cancel = cancelAnimationFrame;
        var delegate = exports.animationFrameProvider.delegate;
        if (delegate) {
          request = delegate.requestAnimationFrame;
          cancel = delegate.cancelAnimationFrame;
        }
        var handle = request(function(timestamp) {
          cancel = void 0;
          callback(timestamp);
        });
        return new Subscription_1.Subscription(function() {
          return cancel === null || cancel === void 0 ? void 0 : cancel(handle);
        });
      },
      requestAnimationFrame: function() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
          args[_i] = arguments[_i];
        }
        var delegate = exports.animationFrameProvider.delegate;
        return ((delegate === null || delegate === void 0 ? void 0 : delegate.requestAnimationFrame) || requestAnimationFrame).apply(void 0, __spreadArray([], __read(args)));
      },
      cancelAnimationFrame: function() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
          args[_i] = arguments[_i];
        }
        var delegate = exports.animationFrameProvider.delegate;
        return ((delegate === null || delegate === void 0 ? void 0 : delegate.cancelAnimationFrame) || cancelAnimationFrame).apply(void 0, __spreadArray([], __read(args)));
      },
      delegate: void 0
    };
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/dom/animationFrames.js
var require_animationFrames = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/dom/animationFrames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.animationFrames = void 0;
    var Observable_1 = require_Observable();
    var performanceTimestampProvider_1 = require_performanceTimestampProvider();
    var animationFrameProvider_1 = require_animationFrameProvider();
    function animationFrames(timestampProvider) {
      return timestampProvider ? animationFramesFactory(timestampProvider) : DEFAULT_ANIMATION_FRAMES;
    }
    exports.animationFrames = animationFrames;
    function animationFramesFactory(timestampProvider) {
      return new Observable_1.Observable(function(subscriber) {
        var provider = timestampProvider || performanceTimestampProvider_1.performanceTimestampProvider;
        var start = provider.now();
        var id = 0;
        var run = function() {
          if (!subscriber.closed) {
            id = animationFrameProvider_1.animationFrameProvider.requestAnimationFrame(function(timestamp) {
              id = 0;
              var now = provider.now();
              subscriber.next({
                timestamp: timestampProvider ? now : timestamp,
                elapsed: now - start
              });
              run();
            });
          }
        };
        run();
        return function() {
          if (id) {
            animationFrameProvider_1.animationFrameProvider.cancelAnimationFrame(id);
          }
        };
      });
    }
    var DEFAULT_ANIMATION_FRAMES = animationFramesFactory();
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/ObjectUnsubscribedError.js
var require_ObjectUnsubscribedError = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/ObjectUnsubscribedError.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ObjectUnsubscribedError = void 0;
    var createErrorClass_1 = require_createErrorClass();
    exports.ObjectUnsubscribedError = createErrorClass_1.createErrorClass(function(_super) {
      return function ObjectUnsubscribedErrorImpl() {
        _super(this);
        this.name = "ObjectUnsubscribedError";
        this.message = "object unsubscribed";
      };
    });
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/Subject.js
var require_Subject = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/Subject.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d2, b2) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
          d3.__proto__ = b3;
        } || function(d3, b3) {
          for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
        };
        return extendStatics(d2, b2);
      };
      return function(d2, b2) {
        if (typeof b2 !== "function" && b2 !== null)
          throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
        extendStatics(d2, b2);
        function __() {
          this.constructor = d2;
        }
        d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
      };
    })();
    var __values = exports && exports.__values || function(o2) {
      var s2 = typeof Symbol === "function" && Symbol.iterator, m2 = s2 && o2[s2], i = 0;
      if (m2) return m2.call(o2);
      if (o2 && typeof o2.length === "number") return {
        next: function() {
          if (o2 && i >= o2.length) o2 = void 0;
          return { value: o2 && o2[i++], done: !o2 };
        }
      };
      throw new TypeError(s2 ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AnonymousSubject = exports.Subject = void 0;
    var Observable_1 = require_Observable();
    var Subscription_1 = require_Subscription();
    var ObjectUnsubscribedError_1 = require_ObjectUnsubscribedError();
    var arrRemove_1 = require_arrRemove();
    var errorContext_1 = require_errorContext();
    var Subject = (function(_super) {
      __extends(Subject2, _super);
      function Subject2() {
        var _this = _super.call(this) || this;
        _this.closed = false;
        _this.currentObservers = null;
        _this.observers = [];
        _this.isStopped = false;
        _this.hasError = false;
        _this.thrownError = null;
        return _this;
      }
      Subject2.prototype.lift = function(operator) {
        var subject = new AnonymousSubject(this, this);
        subject.operator = operator;
        return subject;
      };
      Subject2.prototype._throwIfClosed = function() {
        if (this.closed) {
          throw new ObjectUnsubscribedError_1.ObjectUnsubscribedError();
        }
      };
      Subject2.prototype.next = function(value) {
        var _this = this;
        errorContext_1.errorContext(function() {
          var e_1, _a;
          _this._throwIfClosed();
          if (!_this.isStopped) {
            if (!_this.currentObservers) {
              _this.currentObservers = Array.from(_this.observers);
            }
            try {
              for (var _b = __values(_this.currentObservers), _c = _b.next(); !_c.done; _c = _b.next()) {
                var observer = _c.value;
                observer.next(value);
              }
            } catch (e_1_1) {
              e_1 = { error: e_1_1 };
            } finally {
              try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
              } finally {
                if (e_1) throw e_1.error;
              }
            }
          }
        });
      };
      Subject2.prototype.error = function(err) {
        var _this = this;
        errorContext_1.errorContext(function() {
          _this._throwIfClosed();
          if (!_this.isStopped) {
            _this.hasError = _this.isStopped = true;
            _this.thrownError = err;
            var observers = _this.observers;
            while (observers.length) {
              observers.shift().error(err);
            }
          }
        });
      };
      Subject2.prototype.complete = function() {
        var _this = this;
        errorContext_1.errorContext(function() {
          _this._throwIfClosed();
          if (!_this.isStopped) {
            _this.isStopped = true;
            var observers = _this.observers;
            while (observers.length) {
              observers.shift().complete();
            }
          }
        });
      };
      Subject2.prototype.unsubscribe = function() {
        this.isStopped = this.closed = true;
        this.observers = this.currentObservers = null;
      };
      Object.defineProperty(Subject2.prototype, "observed", {
        get: function() {
          var _a;
          return ((_a = this.observers) === null || _a === void 0 ? void 0 : _a.length) > 0;
        },
        enumerable: false,
        configurable: true
      });
      Subject2.prototype._trySubscribe = function(subscriber) {
        this._throwIfClosed();
        return _super.prototype._trySubscribe.call(this, subscriber);
      };
      Subject2.prototype._subscribe = function(subscriber) {
        this._throwIfClosed();
        this._checkFinalizedStatuses(subscriber);
        return this._innerSubscribe(subscriber);
      };
      Subject2.prototype._innerSubscribe = function(subscriber) {
        var _this = this;
        var _a = this, hasError = _a.hasError, isStopped = _a.isStopped, observers = _a.observers;
        if (hasError || isStopped) {
          return Subscription_1.EMPTY_SUBSCRIPTION;
        }
        this.currentObservers = null;
        observers.push(subscriber);
        return new Subscription_1.Subscription(function() {
          _this.currentObservers = null;
          arrRemove_1.arrRemove(observers, subscriber);
        });
      };
      Subject2.prototype._checkFinalizedStatuses = function(subscriber) {
        var _a = this, hasError = _a.hasError, thrownError = _a.thrownError, isStopped = _a.isStopped;
        if (hasError) {
          subscriber.error(thrownError);
        } else if (isStopped) {
          subscriber.complete();
        }
      };
      Subject2.prototype.asObservable = function() {
        var observable = new Observable_1.Observable();
        observable.source = this;
        return observable;
      };
      Subject2.create = function(destination, source) {
        return new AnonymousSubject(destination, source);
      };
      return Subject2;
    })(Observable_1.Observable);
    exports.Subject = Subject;
    var AnonymousSubject = (function(_super) {
      __extends(AnonymousSubject2, _super);
      function AnonymousSubject2(destination, source) {
        var _this = _super.call(this) || this;
        _this.destination = destination;
        _this.source = source;
        return _this;
      }
      AnonymousSubject2.prototype.next = function(value) {
        var _a, _b;
        (_b = (_a = this.destination) === null || _a === void 0 ? void 0 : _a.next) === null || _b === void 0 ? void 0 : _b.call(_a, value);
      };
      AnonymousSubject2.prototype.error = function(err) {
        var _a, _b;
        (_b = (_a = this.destination) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.call(_a, err);
      };
      AnonymousSubject2.prototype.complete = function() {
        var _a, _b;
        (_b = (_a = this.destination) === null || _a === void 0 ? void 0 : _a.complete) === null || _b === void 0 ? void 0 : _b.call(_a);
      };
      AnonymousSubject2.prototype._subscribe = function(subscriber) {
        var _a, _b;
        return (_b = (_a = this.source) === null || _a === void 0 ? void 0 : _a.subscribe(subscriber)) !== null && _b !== void 0 ? _b : Subscription_1.EMPTY_SUBSCRIPTION;
      };
      return AnonymousSubject2;
    })(Subject);
    exports.AnonymousSubject = AnonymousSubject;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/BehaviorSubject.js
var require_BehaviorSubject = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/BehaviorSubject.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d2, b2) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
          d3.__proto__ = b3;
        } || function(d3, b3) {
          for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
        };
        return extendStatics(d2, b2);
      };
      return function(d2, b2) {
        if (typeof b2 !== "function" && b2 !== null)
          throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
        extendStatics(d2, b2);
        function __() {
          this.constructor = d2;
        }
        d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BehaviorSubject = void 0;
    var Subject_1 = require_Subject();
    var BehaviorSubject = (function(_super) {
      __extends(BehaviorSubject2, _super);
      function BehaviorSubject2(_value) {
        var _this = _super.call(this) || this;
        _this._value = _value;
        return _this;
      }
      Object.defineProperty(BehaviorSubject2.prototype, "value", {
        get: function() {
          return this.getValue();
        },
        enumerable: false,
        configurable: true
      });
      BehaviorSubject2.prototype._subscribe = function(subscriber) {
        var subscription = _super.prototype._subscribe.call(this, subscriber);
        !subscription.closed && subscriber.next(this._value);
        return subscription;
      };
      BehaviorSubject2.prototype.getValue = function() {
        var _a = this, hasError = _a.hasError, thrownError = _a.thrownError, _value = _a._value;
        if (hasError) {
          throw thrownError;
        }
        this._throwIfClosed();
        return _value;
      };
      BehaviorSubject2.prototype.next = function(value) {
        _super.prototype.next.call(this, this._value = value);
      };
      return BehaviorSubject2;
    })(Subject_1.Subject);
    exports.BehaviorSubject = BehaviorSubject;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/dateTimestampProvider.js
var require_dateTimestampProvider = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/dateTimestampProvider.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dateTimestampProvider = void 0;
    exports.dateTimestampProvider = {
      now: function() {
        return (exports.dateTimestampProvider.delegate || Date).now();
      },
      delegate: void 0
    };
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/ReplaySubject.js
var require_ReplaySubject = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/ReplaySubject.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d2, b2) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
          d3.__proto__ = b3;
        } || function(d3, b3) {
          for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
        };
        return extendStatics(d2, b2);
      };
      return function(d2, b2) {
        if (typeof b2 !== "function" && b2 !== null)
          throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
        extendStatics(d2, b2);
        function __() {
          this.constructor = d2;
        }
        d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ReplaySubject = void 0;
    var Subject_1 = require_Subject();
    var dateTimestampProvider_1 = require_dateTimestampProvider();
    var ReplaySubject = (function(_super) {
      __extends(ReplaySubject2, _super);
      function ReplaySubject2(_bufferSize, _windowTime, _timestampProvider) {
        if (_bufferSize === void 0) {
          _bufferSize = Infinity;
        }
        if (_windowTime === void 0) {
          _windowTime = Infinity;
        }
        if (_timestampProvider === void 0) {
          _timestampProvider = dateTimestampProvider_1.dateTimestampProvider;
        }
        var _this = _super.call(this) || this;
        _this._bufferSize = _bufferSize;
        _this._windowTime = _windowTime;
        _this._timestampProvider = _timestampProvider;
        _this._buffer = [];
        _this._infiniteTimeWindow = true;
        _this._infiniteTimeWindow = _windowTime === Infinity;
        _this._bufferSize = Math.max(1, _bufferSize);
        _this._windowTime = Math.max(1, _windowTime);
        return _this;
      }
      ReplaySubject2.prototype.next = function(value) {
        var _a = this, isStopped = _a.isStopped, _buffer = _a._buffer, _infiniteTimeWindow = _a._infiniteTimeWindow, _timestampProvider = _a._timestampProvider, _windowTime = _a._windowTime;
        if (!isStopped) {
          _buffer.push(value);
          !_infiniteTimeWindow && _buffer.push(_timestampProvider.now() + _windowTime);
        }
        this._trimBuffer();
        _super.prototype.next.call(this, value);
      };
      ReplaySubject2.prototype._subscribe = function(subscriber) {
        this._throwIfClosed();
        this._trimBuffer();
        var subscription = this._innerSubscribe(subscriber);
        var _a = this, _infiniteTimeWindow = _a._infiniteTimeWindow, _buffer = _a._buffer;
        var copy = _buffer.slice();
        for (var i = 0; i < copy.length && !subscriber.closed; i += _infiniteTimeWindow ? 1 : 2) {
          subscriber.next(copy[i]);
        }
        this._checkFinalizedStatuses(subscriber);
        return subscription;
      };
      ReplaySubject2.prototype._trimBuffer = function() {
        var _a = this, _bufferSize = _a._bufferSize, _timestampProvider = _a._timestampProvider, _buffer = _a._buffer, _infiniteTimeWindow = _a._infiniteTimeWindow;
        var adjustedBufferSize = (_infiniteTimeWindow ? 1 : 2) * _bufferSize;
        _bufferSize < Infinity && adjustedBufferSize < _buffer.length && _buffer.splice(0, _buffer.length - adjustedBufferSize);
        if (!_infiniteTimeWindow) {
          var now = _timestampProvider.now();
          var last = 0;
          for (var i = 1; i < _buffer.length && _buffer[i] <= now; i += 2) {
            last = i;
          }
          last && _buffer.splice(0, last + 1);
        }
      };
      return ReplaySubject2;
    })(Subject_1.Subject);
    exports.ReplaySubject = ReplaySubject;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/AsyncSubject.js
var require_AsyncSubject = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/AsyncSubject.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d2, b2) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
          d3.__proto__ = b3;
        } || function(d3, b3) {
          for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
        };
        return extendStatics(d2, b2);
      };
      return function(d2, b2) {
        if (typeof b2 !== "function" && b2 !== null)
          throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
        extendStatics(d2, b2);
        function __() {
          this.constructor = d2;
        }
        d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AsyncSubject = void 0;
    var Subject_1 = require_Subject();
    var AsyncSubject = (function(_super) {
      __extends(AsyncSubject2, _super);
      function AsyncSubject2() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this._value = null;
        _this._hasValue = false;
        _this._isComplete = false;
        return _this;
      }
      AsyncSubject2.prototype._checkFinalizedStatuses = function(subscriber) {
        var _a = this, hasError = _a.hasError, _hasValue = _a._hasValue, _value = _a._value, thrownError = _a.thrownError, isStopped = _a.isStopped, _isComplete = _a._isComplete;
        if (hasError) {
          subscriber.error(thrownError);
        } else if (isStopped || _isComplete) {
          _hasValue && subscriber.next(_value);
          subscriber.complete();
        }
      };
      AsyncSubject2.prototype.next = function(value) {
        if (!this.isStopped) {
          this._value = value;
          this._hasValue = true;
        }
      };
      AsyncSubject2.prototype.complete = function() {
        var _a = this, _hasValue = _a._hasValue, _value = _a._value, _isComplete = _a._isComplete;
        if (!_isComplete) {
          this._isComplete = true;
          _hasValue && _super.prototype.next.call(this, _value);
          _super.prototype.complete.call(this);
        }
      };
      return AsyncSubject2;
    })(Subject_1.Subject);
    exports.AsyncSubject = AsyncSubject;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/Action.js
var require_Action = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/Action.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d2, b2) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
          d3.__proto__ = b3;
        } || function(d3, b3) {
          for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
        };
        return extendStatics(d2, b2);
      };
      return function(d2, b2) {
        if (typeof b2 !== "function" && b2 !== null)
          throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
        extendStatics(d2, b2);
        function __() {
          this.constructor = d2;
        }
        d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = void 0;
    var Subscription_1 = require_Subscription();
    var Action = (function(_super) {
      __extends(Action2, _super);
      function Action2(scheduler, work) {
        return _super.call(this) || this;
      }
      Action2.prototype.schedule = function(state, delay) {
        if (delay === void 0) {
          delay = 0;
        }
        return this;
      };
      return Action2;
    })(Subscription_1.Subscription);
    exports.Action = Action;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/intervalProvider.js
var require_intervalProvider = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/intervalProvider.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.intervalProvider = void 0;
    exports.intervalProvider = {
      setInterval: function(handler, timeout) {
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
          args[_i - 2] = arguments[_i];
        }
        var delegate = exports.intervalProvider.delegate;
        if (delegate === null || delegate === void 0 ? void 0 : delegate.setInterval) {
          return delegate.setInterval.apply(delegate, __spreadArray([handler, timeout], __read(args)));
        }
        return setInterval.apply(void 0, __spreadArray([handler, timeout], __read(args)));
      },
      clearInterval: function(handle) {
        var delegate = exports.intervalProvider.delegate;
        return ((delegate === null || delegate === void 0 ? void 0 : delegate.clearInterval) || clearInterval)(handle);
      },
      delegate: void 0
    };
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/AsyncAction.js
var require_AsyncAction = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/AsyncAction.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d2, b2) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
          d3.__proto__ = b3;
        } || function(d3, b3) {
          for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
        };
        return extendStatics(d2, b2);
      };
      return function(d2, b2) {
        if (typeof b2 !== "function" && b2 !== null)
          throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
        extendStatics(d2, b2);
        function __() {
          this.constructor = d2;
        }
        d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AsyncAction = void 0;
    var Action_1 = require_Action();
    var intervalProvider_1 = require_intervalProvider();
    var arrRemove_1 = require_arrRemove();
    var AsyncAction = (function(_super) {
      __extends(AsyncAction2, _super);
      function AsyncAction2(scheduler, work) {
        var _this = _super.call(this, scheduler, work) || this;
        _this.scheduler = scheduler;
        _this.work = work;
        _this.pending = false;
        return _this;
      }
      AsyncAction2.prototype.schedule = function(state, delay) {
        var _a;
        if (delay === void 0) {
          delay = 0;
        }
        if (this.closed) {
          return this;
        }
        this.state = state;
        var id = this.id;
        var scheduler = this.scheduler;
        if (id != null) {
          this.id = this.recycleAsyncId(scheduler, id, delay);
        }
        this.pending = true;
        this.delay = delay;
        this.id = (_a = this.id) !== null && _a !== void 0 ? _a : this.requestAsyncId(scheduler, this.id, delay);
        return this;
      };
      AsyncAction2.prototype.requestAsyncId = function(scheduler, _id, delay) {
        if (delay === void 0) {
          delay = 0;
        }
        return intervalProvider_1.intervalProvider.setInterval(scheduler.flush.bind(scheduler, this), delay);
      };
      AsyncAction2.prototype.recycleAsyncId = function(_scheduler, id, delay) {
        if (delay === void 0) {
          delay = 0;
        }
        if (delay != null && this.delay === delay && this.pending === false) {
          return id;
        }
        if (id != null) {
          intervalProvider_1.intervalProvider.clearInterval(id);
        }
        return void 0;
      };
      AsyncAction2.prototype.execute = function(state, delay) {
        if (this.closed) {
          return new Error("executing a cancelled action");
        }
        this.pending = false;
        var error = this._execute(state, delay);
        if (error) {
          return error;
        } else if (this.pending === false && this.id != null) {
          this.id = this.recycleAsyncId(this.scheduler, this.id, null);
        }
      };
      AsyncAction2.prototype._execute = function(state, _delay) {
        var errored = false;
        var errorValue;
        try {
          this.work(state);
        } catch (e) {
          errored = true;
          errorValue = e ? e : new Error("Scheduled action threw falsy error");
        }
        if (errored) {
          this.unsubscribe();
          return errorValue;
        }
      };
      AsyncAction2.prototype.unsubscribe = function() {
        if (!this.closed) {
          var _a = this, id = _a.id, scheduler = _a.scheduler;
          var actions = scheduler.actions;
          this.work = this.state = this.scheduler = null;
          this.pending = false;
          arrRemove_1.arrRemove(actions, this);
          if (id != null) {
            this.id = this.recycleAsyncId(scheduler, id, null);
          }
          this.delay = null;
          _super.prototype.unsubscribe.call(this);
        }
      };
      return AsyncAction2;
    })(Action_1.Action);
    exports.AsyncAction = AsyncAction;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/Immediate.js
var require_Immediate = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/Immediate.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TestTools = exports.Immediate = void 0;
    var nextHandle = 1;
    var resolved;
    var activeHandles = {};
    function findAndClearHandle(handle) {
      if (handle in activeHandles) {
        delete activeHandles[handle];
        return true;
      }
      return false;
    }
    exports.Immediate = {
      setImmediate: function(cb) {
        var handle = nextHandle++;
        activeHandles[handle] = true;
        if (!resolved) {
          resolved = Promise.resolve();
        }
        resolved.then(function() {
          return findAndClearHandle(handle) && cb();
        });
        return handle;
      },
      clearImmediate: function(handle) {
        findAndClearHandle(handle);
      }
    };
    exports.TestTools = {
      pending: function() {
        return Object.keys(activeHandles).length;
      }
    };
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/immediateProvider.js
var require_immediateProvider = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/immediateProvider.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.immediateProvider = void 0;
    var Immediate_1 = require_Immediate();
    var setImmediate = Immediate_1.Immediate.setImmediate;
    var clearImmediate = Immediate_1.Immediate.clearImmediate;
    exports.immediateProvider = {
      setImmediate: function() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
          args[_i] = arguments[_i];
        }
        var delegate = exports.immediateProvider.delegate;
        return ((delegate === null || delegate === void 0 ? void 0 : delegate.setImmediate) || setImmediate).apply(void 0, __spreadArray([], __read(args)));
      },
      clearImmediate: function(handle) {
        var delegate = exports.immediateProvider.delegate;
        return ((delegate === null || delegate === void 0 ? void 0 : delegate.clearImmediate) || clearImmediate)(handle);
      },
      delegate: void 0
    };
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/AsapAction.js
var require_AsapAction = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/AsapAction.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d2, b2) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
          d3.__proto__ = b3;
        } || function(d3, b3) {
          for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
        };
        return extendStatics(d2, b2);
      };
      return function(d2, b2) {
        if (typeof b2 !== "function" && b2 !== null)
          throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
        extendStatics(d2, b2);
        function __() {
          this.constructor = d2;
        }
        d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AsapAction = void 0;
    var AsyncAction_1 = require_AsyncAction();
    var immediateProvider_1 = require_immediateProvider();
    var AsapAction = (function(_super) {
      __extends(AsapAction2, _super);
      function AsapAction2(scheduler, work) {
        var _this = _super.call(this, scheduler, work) || this;
        _this.scheduler = scheduler;
        _this.work = work;
        return _this;
      }
      AsapAction2.prototype.requestAsyncId = function(scheduler, id, delay) {
        if (delay === void 0) {
          delay = 0;
        }
        if (delay !== null && delay > 0) {
          return _super.prototype.requestAsyncId.call(this, scheduler, id, delay);
        }
        scheduler.actions.push(this);
        return scheduler._scheduled || (scheduler._scheduled = immediateProvider_1.immediateProvider.setImmediate(scheduler.flush.bind(scheduler, void 0)));
      };
      AsapAction2.prototype.recycleAsyncId = function(scheduler, id, delay) {
        var _a;
        if (delay === void 0) {
          delay = 0;
        }
        if (delay != null ? delay > 0 : this.delay > 0) {
          return _super.prototype.recycleAsyncId.call(this, scheduler, id, delay);
        }
        var actions = scheduler.actions;
        if (id != null && ((_a = actions[actions.length - 1]) === null || _a === void 0 ? void 0 : _a.id) !== id) {
          immediateProvider_1.immediateProvider.clearImmediate(id);
          if (scheduler._scheduled === id) {
            scheduler._scheduled = void 0;
          }
        }
        return void 0;
      };
      return AsapAction2;
    })(AsyncAction_1.AsyncAction);
    exports.AsapAction = AsapAction;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/Scheduler.js
var require_Scheduler = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/Scheduler.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Scheduler = void 0;
    var dateTimestampProvider_1 = require_dateTimestampProvider();
    var Scheduler = (function() {
      function Scheduler2(schedulerActionCtor, now) {
        if (now === void 0) {
          now = Scheduler2.now;
        }
        this.schedulerActionCtor = schedulerActionCtor;
        this.now = now;
      }
      Scheduler2.prototype.schedule = function(work, delay, state) {
        if (delay === void 0) {
          delay = 0;
        }
        return new this.schedulerActionCtor(this, work).schedule(state, delay);
      };
      Scheduler2.now = dateTimestampProvider_1.dateTimestampProvider.now;
      return Scheduler2;
    })();
    exports.Scheduler = Scheduler;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/AsyncScheduler.js
var require_AsyncScheduler = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/AsyncScheduler.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d2, b2) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
          d3.__proto__ = b3;
        } || function(d3, b3) {
          for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
        };
        return extendStatics(d2, b2);
      };
      return function(d2, b2) {
        if (typeof b2 !== "function" && b2 !== null)
          throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
        extendStatics(d2, b2);
        function __() {
          this.constructor = d2;
        }
        d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AsyncScheduler = void 0;
    var Scheduler_1 = require_Scheduler();
    var AsyncScheduler = (function(_super) {
      __extends(AsyncScheduler2, _super);
      function AsyncScheduler2(SchedulerAction, now) {
        if (now === void 0) {
          now = Scheduler_1.Scheduler.now;
        }
        var _this = _super.call(this, SchedulerAction, now) || this;
        _this.actions = [];
        _this._active = false;
        return _this;
      }
      AsyncScheduler2.prototype.flush = function(action) {
        var actions = this.actions;
        if (this._active) {
          actions.push(action);
          return;
        }
        var error;
        this._active = true;
        do {
          if (error = action.execute(action.state, action.delay)) {
            break;
          }
        } while (action = actions.shift());
        this._active = false;
        if (error) {
          while (action = actions.shift()) {
            action.unsubscribe();
          }
          throw error;
        }
      };
      return AsyncScheduler2;
    })(Scheduler_1.Scheduler);
    exports.AsyncScheduler = AsyncScheduler;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/AsapScheduler.js
var require_AsapScheduler = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/AsapScheduler.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d2, b2) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
          d3.__proto__ = b3;
        } || function(d3, b3) {
          for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
        };
        return extendStatics(d2, b2);
      };
      return function(d2, b2) {
        if (typeof b2 !== "function" && b2 !== null)
          throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
        extendStatics(d2, b2);
        function __() {
          this.constructor = d2;
        }
        d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AsapScheduler = void 0;
    var AsyncScheduler_1 = require_AsyncScheduler();
    var AsapScheduler = (function(_super) {
      __extends(AsapScheduler2, _super);
      function AsapScheduler2() {
        return _super !== null && _super.apply(this, arguments) || this;
      }
      AsapScheduler2.prototype.flush = function(action) {
        this._active = true;
        var flushId = this._scheduled;
        this._scheduled = void 0;
        var actions = this.actions;
        var error;
        action = action || actions.shift();
        do {
          if (error = action.execute(action.state, action.delay)) {
            break;
          }
        } while ((action = actions[0]) && action.id === flushId && actions.shift());
        this._active = false;
        if (error) {
          while ((action = actions[0]) && action.id === flushId && actions.shift()) {
            action.unsubscribe();
          }
          throw error;
        }
      };
      return AsapScheduler2;
    })(AsyncScheduler_1.AsyncScheduler);
    exports.AsapScheduler = AsapScheduler;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/asap.js
var require_asap = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/asap.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.asap = exports.asapScheduler = void 0;
    var AsapAction_1 = require_AsapAction();
    var AsapScheduler_1 = require_AsapScheduler();
    exports.asapScheduler = new AsapScheduler_1.AsapScheduler(AsapAction_1.AsapAction);
    exports.asap = exports.asapScheduler;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/async.js
var require_async = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/async.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.async = exports.asyncScheduler = void 0;
    var AsyncAction_1 = require_AsyncAction();
    var AsyncScheduler_1 = require_AsyncScheduler();
    exports.asyncScheduler = new AsyncScheduler_1.AsyncScheduler(AsyncAction_1.AsyncAction);
    exports.async = exports.asyncScheduler;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/QueueAction.js
var require_QueueAction = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/QueueAction.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d2, b2) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
          d3.__proto__ = b3;
        } || function(d3, b3) {
          for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
        };
        return extendStatics(d2, b2);
      };
      return function(d2, b2) {
        if (typeof b2 !== "function" && b2 !== null)
          throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
        extendStatics(d2, b2);
        function __() {
          this.constructor = d2;
        }
        d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.QueueAction = void 0;
    var AsyncAction_1 = require_AsyncAction();
    var QueueAction = (function(_super) {
      __extends(QueueAction2, _super);
      function QueueAction2(scheduler, work) {
        var _this = _super.call(this, scheduler, work) || this;
        _this.scheduler = scheduler;
        _this.work = work;
        return _this;
      }
      QueueAction2.prototype.schedule = function(state, delay) {
        if (delay === void 0) {
          delay = 0;
        }
        if (delay > 0) {
          return _super.prototype.schedule.call(this, state, delay);
        }
        this.delay = delay;
        this.state = state;
        this.scheduler.flush(this);
        return this;
      };
      QueueAction2.prototype.execute = function(state, delay) {
        return delay > 0 || this.closed ? _super.prototype.execute.call(this, state, delay) : this._execute(state, delay);
      };
      QueueAction2.prototype.requestAsyncId = function(scheduler, id, delay) {
        if (delay === void 0) {
          delay = 0;
        }
        if (delay != null && delay > 0 || delay == null && this.delay > 0) {
          return _super.prototype.requestAsyncId.call(this, scheduler, id, delay);
        }
        scheduler.flush(this);
        return 0;
      };
      return QueueAction2;
    })(AsyncAction_1.AsyncAction);
    exports.QueueAction = QueueAction;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/QueueScheduler.js
var require_QueueScheduler = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/QueueScheduler.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d2, b2) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
          d3.__proto__ = b3;
        } || function(d3, b3) {
          for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
        };
        return extendStatics(d2, b2);
      };
      return function(d2, b2) {
        if (typeof b2 !== "function" && b2 !== null)
          throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
        extendStatics(d2, b2);
        function __() {
          this.constructor = d2;
        }
        d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.QueueScheduler = void 0;
    var AsyncScheduler_1 = require_AsyncScheduler();
    var QueueScheduler = (function(_super) {
      __extends(QueueScheduler2, _super);
      function QueueScheduler2() {
        return _super !== null && _super.apply(this, arguments) || this;
      }
      return QueueScheduler2;
    })(AsyncScheduler_1.AsyncScheduler);
    exports.QueueScheduler = QueueScheduler;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/queue.js
var require_queue = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/queue.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.queue = exports.queueScheduler = void 0;
    var QueueAction_1 = require_QueueAction();
    var QueueScheduler_1 = require_QueueScheduler();
    exports.queueScheduler = new QueueScheduler_1.QueueScheduler(QueueAction_1.QueueAction);
    exports.queue = exports.queueScheduler;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/AnimationFrameAction.js
var require_AnimationFrameAction = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/AnimationFrameAction.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d2, b2) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
          d3.__proto__ = b3;
        } || function(d3, b3) {
          for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
        };
        return extendStatics(d2, b2);
      };
      return function(d2, b2) {
        if (typeof b2 !== "function" && b2 !== null)
          throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
        extendStatics(d2, b2);
        function __() {
          this.constructor = d2;
        }
        d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AnimationFrameAction = void 0;
    var AsyncAction_1 = require_AsyncAction();
    var animationFrameProvider_1 = require_animationFrameProvider();
    var AnimationFrameAction = (function(_super) {
      __extends(AnimationFrameAction2, _super);
      function AnimationFrameAction2(scheduler, work) {
        var _this = _super.call(this, scheduler, work) || this;
        _this.scheduler = scheduler;
        _this.work = work;
        return _this;
      }
      AnimationFrameAction2.prototype.requestAsyncId = function(scheduler, id, delay) {
        if (delay === void 0) {
          delay = 0;
        }
        if (delay !== null && delay > 0) {
          return _super.prototype.requestAsyncId.call(this, scheduler, id, delay);
        }
        scheduler.actions.push(this);
        return scheduler._scheduled || (scheduler._scheduled = animationFrameProvider_1.animationFrameProvider.requestAnimationFrame(function() {
          return scheduler.flush(void 0);
        }));
      };
      AnimationFrameAction2.prototype.recycleAsyncId = function(scheduler, id, delay) {
        var _a;
        if (delay === void 0) {
          delay = 0;
        }
        if (delay != null ? delay > 0 : this.delay > 0) {
          return _super.prototype.recycleAsyncId.call(this, scheduler, id, delay);
        }
        var actions = scheduler.actions;
        if (id != null && ((_a = actions[actions.length - 1]) === null || _a === void 0 ? void 0 : _a.id) !== id) {
          animationFrameProvider_1.animationFrameProvider.cancelAnimationFrame(id);
          scheduler._scheduled = void 0;
        }
        return void 0;
      };
      return AnimationFrameAction2;
    })(AsyncAction_1.AsyncAction);
    exports.AnimationFrameAction = AnimationFrameAction;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/AnimationFrameScheduler.js
var require_AnimationFrameScheduler = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/AnimationFrameScheduler.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d2, b2) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
          d3.__proto__ = b3;
        } || function(d3, b3) {
          for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
        };
        return extendStatics(d2, b2);
      };
      return function(d2, b2) {
        if (typeof b2 !== "function" && b2 !== null)
          throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
        extendStatics(d2, b2);
        function __() {
          this.constructor = d2;
        }
        d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AnimationFrameScheduler = void 0;
    var AsyncScheduler_1 = require_AsyncScheduler();
    var AnimationFrameScheduler = (function(_super) {
      __extends(AnimationFrameScheduler2, _super);
      function AnimationFrameScheduler2() {
        return _super !== null && _super.apply(this, arguments) || this;
      }
      AnimationFrameScheduler2.prototype.flush = function(action) {
        this._active = true;
        var flushId = this._scheduled;
        this._scheduled = void 0;
        var actions = this.actions;
        var error;
        action = action || actions.shift();
        do {
          if (error = action.execute(action.state, action.delay)) {
            break;
          }
        } while ((action = actions[0]) && action.id === flushId && actions.shift());
        this._active = false;
        if (error) {
          while ((action = actions[0]) && action.id === flushId && actions.shift()) {
            action.unsubscribe();
          }
          throw error;
        }
      };
      return AnimationFrameScheduler2;
    })(AsyncScheduler_1.AsyncScheduler);
    exports.AnimationFrameScheduler = AnimationFrameScheduler;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/animationFrame.js
var require_animationFrame = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/animationFrame.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.animationFrame = exports.animationFrameScheduler = void 0;
    var AnimationFrameAction_1 = require_AnimationFrameAction();
    var AnimationFrameScheduler_1 = require_AnimationFrameScheduler();
    exports.animationFrameScheduler = new AnimationFrameScheduler_1.AnimationFrameScheduler(AnimationFrameAction_1.AnimationFrameAction);
    exports.animationFrame = exports.animationFrameScheduler;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/VirtualTimeScheduler.js
var require_VirtualTimeScheduler = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduler/VirtualTimeScheduler.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d2, b2) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
          d3.__proto__ = b3;
        } || function(d3, b3) {
          for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
        };
        return extendStatics(d2, b2);
      };
      return function(d2, b2) {
        if (typeof b2 !== "function" && b2 !== null)
          throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
        extendStatics(d2, b2);
        function __() {
          this.constructor = d2;
        }
        d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.VirtualAction = exports.VirtualTimeScheduler = void 0;
    var AsyncAction_1 = require_AsyncAction();
    var Subscription_1 = require_Subscription();
    var AsyncScheduler_1 = require_AsyncScheduler();
    var VirtualTimeScheduler = (function(_super) {
      __extends(VirtualTimeScheduler2, _super);
      function VirtualTimeScheduler2(schedulerActionCtor, maxFrames) {
        if (schedulerActionCtor === void 0) {
          schedulerActionCtor = VirtualAction;
        }
        if (maxFrames === void 0) {
          maxFrames = Infinity;
        }
        var _this = _super.call(this, schedulerActionCtor, function() {
          return _this.frame;
        }) || this;
        _this.maxFrames = maxFrames;
        _this.frame = 0;
        _this.index = -1;
        return _this;
      }
      VirtualTimeScheduler2.prototype.flush = function() {
        var _a = this, actions = _a.actions, maxFrames = _a.maxFrames;
        var error;
        var action;
        while ((action = actions[0]) && action.delay <= maxFrames) {
          actions.shift();
          this.frame = action.delay;
          if (error = action.execute(action.state, action.delay)) {
            break;
          }
        }
        if (error) {
          while (action = actions.shift()) {
            action.unsubscribe();
          }
          throw error;
        }
      };
      VirtualTimeScheduler2.frameTimeFactor = 10;
      return VirtualTimeScheduler2;
    })(AsyncScheduler_1.AsyncScheduler);
    exports.VirtualTimeScheduler = VirtualTimeScheduler;
    var VirtualAction = (function(_super) {
      __extends(VirtualAction2, _super);
      function VirtualAction2(scheduler, work, index) {
        if (index === void 0) {
          index = scheduler.index += 1;
        }
        var _this = _super.call(this, scheduler, work) || this;
        _this.scheduler = scheduler;
        _this.work = work;
        _this.index = index;
        _this.active = true;
        _this.index = scheduler.index = index;
        return _this;
      }
      VirtualAction2.prototype.schedule = function(state, delay) {
        if (delay === void 0) {
          delay = 0;
        }
        if (Number.isFinite(delay)) {
          if (!this.id) {
            return _super.prototype.schedule.call(this, state, delay);
          }
          this.active = false;
          var action = new VirtualAction2(this.scheduler, this.work);
          this.add(action);
          return action.schedule(state, delay);
        } else {
          return Subscription_1.Subscription.EMPTY;
        }
      };
      VirtualAction2.prototype.requestAsyncId = function(scheduler, id, delay) {
        if (delay === void 0) {
          delay = 0;
        }
        this.delay = scheduler.frame + delay;
        var actions = scheduler.actions;
        actions.push(this);
        actions.sort(VirtualAction2.sortActions);
        return 1;
      };
      VirtualAction2.prototype.recycleAsyncId = function(scheduler, id, delay) {
        if (delay === void 0) {
          delay = 0;
        }
        return void 0;
      };
      VirtualAction2.prototype._execute = function(state, delay) {
        if (this.active === true) {
          return _super.prototype._execute.call(this, state, delay);
        }
      };
      VirtualAction2.sortActions = function(a2, b2) {
        if (a2.delay === b2.delay) {
          if (a2.index === b2.index) {
            return 0;
          } else if (a2.index > b2.index) {
            return 1;
          } else {
            return -1;
          }
        } else if (a2.delay > b2.delay) {
          return 1;
        } else {
          return -1;
        }
      };
      return VirtualAction2;
    })(AsyncAction_1.AsyncAction);
    exports.VirtualAction = VirtualAction;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/empty.js
var require_empty = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/empty.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.empty = exports.EMPTY = void 0;
    var Observable_1 = require_Observable();
    exports.EMPTY = new Observable_1.Observable(function(subscriber) {
      return subscriber.complete();
    });
    function empty(scheduler) {
      return scheduler ? emptyScheduled(scheduler) : exports.EMPTY;
    }
    exports.empty = empty;
    function emptyScheduled(scheduler) {
      return new Observable_1.Observable(function(subscriber) {
        return scheduler.schedule(function() {
          return subscriber.complete();
        });
      });
    }
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isScheduler.js
var require_isScheduler = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isScheduler.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isScheduler = void 0;
    var isFunction_1 = require_isFunction();
    function isScheduler(value) {
      return value && isFunction_1.isFunction(value.schedule);
    }
    exports.isScheduler = isScheduler;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/args.js
var require_args = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/args.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.popNumber = exports.popScheduler = exports.popResultSelector = void 0;
    var isFunction_1 = require_isFunction();
    var isScheduler_1 = require_isScheduler();
    function last(arr) {
      return arr[arr.length - 1];
    }
    function popResultSelector(args) {
      return isFunction_1.isFunction(last(args)) ? args.pop() : void 0;
    }
    exports.popResultSelector = popResultSelector;
    function popScheduler(args) {
      return isScheduler_1.isScheduler(last(args)) ? args.pop() : void 0;
    }
    exports.popScheduler = popScheduler;
    function popNumber(args, defaultValue) {
      return typeof last(args) === "number" ? args.pop() : defaultValue;
    }
    exports.popNumber = popNumber;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isArrayLike.js
var require_isArrayLike = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isArrayLike.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isArrayLike = void 0;
    exports.isArrayLike = (function(x2) {
      return x2 && typeof x2.length === "number" && typeof x2 !== "function";
    });
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isPromise.js
var require_isPromise = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isPromise.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isPromise = void 0;
    var isFunction_1 = require_isFunction();
    function isPromise(value) {
      return isFunction_1.isFunction(value === null || value === void 0 ? void 0 : value.then);
    }
    exports.isPromise = isPromise;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isInteropObservable.js
var require_isInteropObservable = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isInteropObservable.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isInteropObservable = void 0;
    var observable_1 = require_observable();
    var isFunction_1 = require_isFunction();
    function isInteropObservable(input) {
      return isFunction_1.isFunction(input[observable_1.observable]);
    }
    exports.isInteropObservable = isInteropObservable;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isAsyncIterable.js
var require_isAsyncIterable = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isAsyncIterable.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isAsyncIterable = void 0;
    var isFunction_1 = require_isFunction();
    function isAsyncIterable(obj) {
      return Symbol.asyncIterator && isFunction_1.isFunction(obj === null || obj === void 0 ? void 0 : obj[Symbol.asyncIterator]);
    }
    exports.isAsyncIterable = isAsyncIterable;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/throwUnobservableError.js
var require_throwUnobservableError = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/throwUnobservableError.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createInvalidObservableTypeError = void 0;
    function createInvalidObservableTypeError(input) {
      return new TypeError("You provided " + (input !== null && typeof input === "object" ? "an invalid object" : "'" + input + "'") + " where a stream was expected. You can provide an Observable, Promise, ReadableStream, Array, AsyncIterable, or Iterable.");
    }
    exports.createInvalidObservableTypeError = createInvalidObservableTypeError;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/symbol/iterator.js
var require_iterator = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/symbol/iterator.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.iterator = exports.getSymbolIterator = void 0;
    function getSymbolIterator() {
      if (typeof Symbol !== "function" || !Symbol.iterator) {
        return "@@iterator";
      }
      return Symbol.iterator;
    }
    exports.getSymbolIterator = getSymbolIterator;
    exports.iterator = getSymbolIterator();
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isIterable.js
var require_isIterable = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isIterable.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isIterable = void 0;
    var iterator_1 = require_iterator();
    var isFunction_1 = require_isFunction();
    function isIterable(input) {
      return isFunction_1.isFunction(input === null || input === void 0 ? void 0 : input[iterator_1.iterator]);
    }
    exports.isIterable = isIterable;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isReadableStreamLike.js
var require_isReadableStreamLike = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isReadableStreamLike.js"(exports) {
    "use strict";
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _2 = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f2, y2, t, g2;
      return g2 = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g2[Symbol.iterator] = function() {
        return this;
      }), g2;
      function verb(n) {
        return function(v2) {
          return step([n, v2]);
        };
      }
      function step(op) {
        if (f2) throw new TypeError("Generator is already executing.");
        while (_2) try {
          if (f2 = 1, y2 && (t = op[0] & 2 ? y2["return"] : op[0] ? y2["throw"] || ((t = y2["return"]) && t.call(y2), 0) : y2.next) && !(t = t.call(y2, op[1])).done) return t;
          if (y2 = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _2.label++;
              return { value: op[1], done: false };
            case 5:
              _2.label++;
              y2 = op[1];
              op = [0];
              continue;
            case 7:
              op = _2.ops.pop();
              _2.trys.pop();
              continue;
            default:
              if (!(t = _2.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _2 = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _2.label = op[1];
                break;
              }
              if (op[0] === 6 && _2.label < t[1]) {
                _2.label = t[1];
                t = op;
                break;
              }
              if (t && _2.label < t[2]) {
                _2.label = t[2];
                _2.ops.push(op);
                break;
              }
              if (t[2]) _2.ops.pop();
              _2.trys.pop();
              continue;
          }
          op = body.call(thisArg, _2);
        } catch (e) {
          op = [6, e];
          y2 = 0;
        } finally {
          f2 = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    var __await = exports && exports.__await || function(v2) {
      return this instanceof __await ? (this.v = v2, this) : new __await(v2);
    };
    var __asyncGenerator = exports && exports.__asyncGenerator || function(thisArg, _arguments, generator) {
      if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
      var g2 = generator.apply(thisArg, _arguments || []), i, q2 = [];
      return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
        return this;
      }, i;
      function verb(n) {
        if (g2[n]) i[n] = function(v2) {
          return new Promise(function(a2, b2) {
            q2.push([n, v2, a2, b2]) > 1 || resume(n, v2);
          });
        };
      }
      function resume(n, v2) {
        try {
          step(g2[n](v2));
        } catch (e) {
          settle(q2[0][3], e);
        }
      }
      function step(r) {
        r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q2[0][2], r);
      }
      function fulfill(value) {
        resume("next", value);
      }
      function reject(value) {
        resume("throw", value);
      }
      function settle(f2, v2) {
        if (f2(v2), q2.shift(), q2.length) resume(q2[0][0], q2[0][1]);
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isReadableStreamLike = exports.readableStreamLikeToAsyncGenerator = void 0;
    var isFunction_1 = require_isFunction();
    function readableStreamLikeToAsyncGenerator(readableStream) {
      return __asyncGenerator(this, arguments, function readableStreamLikeToAsyncGenerator_1() {
        var reader, _a, value, done;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              reader = readableStream.getReader();
              _b.label = 1;
            case 1:
              _b.trys.push([1, , 9, 10]);
              _b.label = 2;
            case 2:
              if (false) return [3, 8];
              return [4, __await(reader.read())];
            case 3:
              _a = _b.sent(), value = _a.value, done = _a.done;
              if (!done) return [3, 5];
              return [4, __await(void 0)];
            case 4:
              return [2, _b.sent()];
            case 5:
              return [4, __await(value)];
            case 6:
              return [4, _b.sent()];
            case 7:
              _b.sent();
              return [3, 2];
            case 8:
              return [3, 10];
            case 9:
              reader.releaseLock();
              return [7];
            case 10:
              return [2];
          }
        });
      });
    }
    exports.readableStreamLikeToAsyncGenerator = readableStreamLikeToAsyncGenerator;
    function isReadableStreamLike(obj) {
      return isFunction_1.isFunction(obj === null || obj === void 0 ? void 0 : obj.getReader);
    }
    exports.isReadableStreamLike = isReadableStreamLike;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/innerFrom.js
var require_innerFrom = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/innerFrom.js"(exports) {
    "use strict";
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P2, generator) {
      function adopt(value) {
        return value instanceof P2 ? value : new P2(function(resolve) {
          resolve(value);
        });
      }
      return new (P2 || (P2 = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _2 = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f2, y2, t, g2;
      return g2 = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g2[Symbol.iterator] = function() {
        return this;
      }), g2;
      function verb(n) {
        return function(v2) {
          return step([n, v2]);
        };
      }
      function step(op) {
        if (f2) throw new TypeError("Generator is already executing.");
        while (_2) try {
          if (f2 = 1, y2 && (t = op[0] & 2 ? y2["return"] : op[0] ? y2["throw"] || ((t = y2["return"]) && t.call(y2), 0) : y2.next) && !(t = t.call(y2, op[1])).done) return t;
          if (y2 = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _2.label++;
              return { value: op[1], done: false };
            case 5:
              _2.label++;
              y2 = op[1];
              op = [0];
              continue;
            case 7:
              op = _2.ops.pop();
              _2.trys.pop();
              continue;
            default:
              if (!(t = _2.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _2 = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _2.label = op[1];
                break;
              }
              if (op[0] === 6 && _2.label < t[1]) {
                _2.label = t[1];
                t = op;
                break;
              }
              if (t && _2.label < t[2]) {
                _2.label = t[2];
                _2.ops.push(op);
                break;
              }
              if (t[2]) _2.ops.pop();
              _2.trys.pop();
              continue;
          }
          op = body.call(thisArg, _2);
        } catch (e) {
          op = [6, e];
          y2 = 0;
        } finally {
          f2 = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    var __asyncValues = exports && exports.__asyncValues || function(o2) {
      if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
      var m2 = o2[Symbol.asyncIterator], i;
      return m2 ? m2.call(o2) : (o2 = typeof __values === "function" ? __values(o2) : o2[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
        return this;
      }, i);
      function verb(n) {
        i[n] = o2[n] && function(v2) {
          return new Promise(function(resolve, reject) {
            v2 = o2[n](v2), settle(resolve, reject, v2.done, v2.value);
          });
        };
      }
      function settle(resolve, reject, d2, v2) {
        Promise.resolve(v2).then(function(v3) {
          resolve({ value: v3, done: d2 });
        }, reject);
      }
    };
    var __values = exports && exports.__values || function(o2) {
      var s2 = typeof Symbol === "function" && Symbol.iterator, m2 = s2 && o2[s2], i = 0;
      if (m2) return m2.call(o2);
      if (o2 && typeof o2.length === "number") return {
        next: function() {
          if (o2 && i >= o2.length) o2 = void 0;
          return { value: o2 && o2[i++], done: !o2 };
        }
      };
      throw new TypeError(s2 ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.fromReadableStreamLike = exports.fromAsyncIterable = exports.fromIterable = exports.fromPromise = exports.fromArrayLike = exports.fromInteropObservable = exports.innerFrom = void 0;
    var isArrayLike_1 = require_isArrayLike();
    var isPromise_1 = require_isPromise();
    var Observable_1 = require_Observable();
    var isInteropObservable_1 = require_isInteropObservable();
    var isAsyncIterable_1 = require_isAsyncIterable();
    var throwUnobservableError_1 = require_throwUnobservableError();
    var isIterable_1 = require_isIterable();
    var isReadableStreamLike_1 = require_isReadableStreamLike();
    var isFunction_1 = require_isFunction();
    var reportUnhandledError_1 = require_reportUnhandledError();
    var observable_1 = require_observable();
    function innerFrom(input) {
      if (input instanceof Observable_1.Observable) {
        return input;
      }
      if (input != null) {
        if (isInteropObservable_1.isInteropObservable(input)) {
          return fromInteropObservable(input);
        }
        if (isArrayLike_1.isArrayLike(input)) {
          return fromArrayLike(input);
        }
        if (isPromise_1.isPromise(input)) {
          return fromPromise(input);
        }
        if (isAsyncIterable_1.isAsyncIterable(input)) {
          return fromAsyncIterable(input);
        }
        if (isIterable_1.isIterable(input)) {
          return fromIterable(input);
        }
        if (isReadableStreamLike_1.isReadableStreamLike(input)) {
          return fromReadableStreamLike(input);
        }
      }
      throw throwUnobservableError_1.createInvalidObservableTypeError(input);
    }
    exports.innerFrom = innerFrom;
    function fromInteropObservable(obj) {
      return new Observable_1.Observable(function(subscriber) {
        var obs = obj[observable_1.observable]();
        if (isFunction_1.isFunction(obs.subscribe)) {
          return obs.subscribe(subscriber);
        }
        throw new TypeError("Provided object does not correctly implement Symbol.observable");
      });
    }
    exports.fromInteropObservable = fromInteropObservable;
    function fromArrayLike(array) {
      return new Observable_1.Observable(function(subscriber) {
        for (var i = 0; i < array.length && !subscriber.closed; i++) {
          subscriber.next(array[i]);
        }
        subscriber.complete();
      });
    }
    exports.fromArrayLike = fromArrayLike;
    function fromPromise(promise) {
      return new Observable_1.Observable(function(subscriber) {
        promise.then(function(value) {
          if (!subscriber.closed) {
            subscriber.next(value);
            subscriber.complete();
          }
        }, function(err) {
          return subscriber.error(err);
        }).then(null, reportUnhandledError_1.reportUnhandledError);
      });
    }
    exports.fromPromise = fromPromise;
    function fromIterable(iterable) {
      return new Observable_1.Observable(function(subscriber) {
        var e_1, _a;
        try {
          for (var iterable_1 = __values(iterable), iterable_1_1 = iterable_1.next(); !iterable_1_1.done; iterable_1_1 = iterable_1.next()) {
            var value = iterable_1_1.value;
            subscriber.next(value);
            if (subscriber.closed) {
              return;
            }
          }
        } catch (e_1_1) {
          e_1 = { error: e_1_1 };
        } finally {
          try {
            if (iterable_1_1 && !iterable_1_1.done && (_a = iterable_1.return)) _a.call(iterable_1);
          } finally {
            if (e_1) throw e_1.error;
          }
        }
        subscriber.complete();
      });
    }
    exports.fromIterable = fromIterable;
    function fromAsyncIterable(asyncIterable) {
      return new Observable_1.Observable(function(subscriber) {
        process2(asyncIterable, subscriber).catch(function(err) {
          return subscriber.error(err);
        });
      });
    }
    exports.fromAsyncIterable = fromAsyncIterable;
    function fromReadableStreamLike(readableStream) {
      return fromAsyncIterable(isReadableStreamLike_1.readableStreamLikeToAsyncGenerator(readableStream));
    }
    exports.fromReadableStreamLike = fromReadableStreamLike;
    function process2(asyncIterable, subscriber) {
      var asyncIterable_1, asyncIterable_1_1;
      var e_2, _a;
      return __awaiter(this, void 0, void 0, function() {
        var value, e_2_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              _b.trys.push([0, 5, 6, 11]);
              asyncIterable_1 = __asyncValues(asyncIterable);
              _b.label = 1;
            case 1:
              return [4, asyncIterable_1.next()];
            case 2:
              if (!(asyncIterable_1_1 = _b.sent(), !asyncIterable_1_1.done)) return [3, 4];
              value = asyncIterable_1_1.value;
              subscriber.next(value);
              if (subscriber.closed) {
                return [2];
              }
              _b.label = 3;
            case 3:
              return [3, 1];
            case 4:
              return [3, 11];
            case 5:
              e_2_1 = _b.sent();
              e_2 = { error: e_2_1 };
              return [3, 11];
            case 6:
              _b.trys.push([6, , 9, 10]);
              if (!(asyncIterable_1_1 && !asyncIterable_1_1.done && (_a = asyncIterable_1.return))) return [3, 8];
              return [4, _a.call(asyncIterable_1)];
            case 7:
              _b.sent();
              _b.label = 8;
            case 8:
              return [3, 10];
            case 9:
              if (e_2) throw e_2.error;
              return [7];
            case 10:
              return [7];
            case 11:
              subscriber.complete();
              return [2];
          }
        });
      });
    }
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/executeSchedule.js
var require_executeSchedule = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/executeSchedule.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.executeSchedule = void 0;
    function executeSchedule(parentSubscription, scheduler, work, delay, repeat) {
      if (delay === void 0) {
        delay = 0;
      }
      if (repeat === void 0) {
        repeat = false;
      }
      var scheduleSubscription = scheduler.schedule(function() {
        work();
        if (repeat) {
          parentSubscription.add(this.schedule(null, delay));
        } else {
          this.unsubscribe();
        }
      }, delay);
      parentSubscription.add(scheduleSubscription);
      if (!repeat) {
        return scheduleSubscription;
      }
    }
    exports.executeSchedule = executeSchedule;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/observeOn.js
var require_observeOn = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/observeOn.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.observeOn = void 0;
    var executeSchedule_1 = require_executeSchedule();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function observeOn(scheduler, delay) {
      if (delay === void 0) {
        delay = 0;
      }
      return lift_1.operate(function(source, subscriber) {
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          return executeSchedule_1.executeSchedule(subscriber, scheduler, function() {
            return subscriber.next(value);
          }, delay);
        }, function() {
          return executeSchedule_1.executeSchedule(subscriber, scheduler, function() {
            return subscriber.complete();
          }, delay);
        }, function(err) {
          return executeSchedule_1.executeSchedule(subscriber, scheduler, function() {
            return subscriber.error(err);
          }, delay);
        }));
      });
    }
    exports.observeOn = observeOn;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/subscribeOn.js
var require_subscribeOn = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/subscribeOn.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.subscribeOn = void 0;
    var lift_1 = require_lift();
    function subscribeOn(scheduler, delay) {
      if (delay === void 0) {
        delay = 0;
      }
      return lift_1.operate(function(source, subscriber) {
        subscriber.add(scheduler.schedule(function() {
          return source.subscribe(subscriber);
        }, delay));
      });
    }
    exports.subscribeOn = subscribeOn;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduled/scheduleObservable.js
var require_scheduleObservable = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduled/scheduleObservable.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.scheduleObservable = void 0;
    var innerFrom_1 = require_innerFrom();
    var observeOn_1 = require_observeOn();
    var subscribeOn_1 = require_subscribeOn();
    function scheduleObservable(input, scheduler) {
      return innerFrom_1.innerFrom(input).pipe(subscribeOn_1.subscribeOn(scheduler), observeOn_1.observeOn(scheduler));
    }
    exports.scheduleObservable = scheduleObservable;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduled/schedulePromise.js
var require_schedulePromise = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduled/schedulePromise.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.schedulePromise = void 0;
    var innerFrom_1 = require_innerFrom();
    var observeOn_1 = require_observeOn();
    var subscribeOn_1 = require_subscribeOn();
    function schedulePromise(input, scheduler) {
      return innerFrom_1.innerFrom(input).pipe(subscribeOn_1.subscribeOn(scheduler), observeOn_1.observeOn(scheduler));
    }
    exports.schedulePromise = schedulePromise;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduled/scheduleArray.js
var require_scheduleArray = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduled/scheduleArray.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.scheduleArray = void 0;
    var Observable_1 = require_Observable();
    function scheduleArray(input, scheduler) {
      return new Observable_1.Observable(function(subscriber) {
        var i = 0;
        return scheduler.schedule(function() {
          if (i === input.length) {
            subscriber.complete();
          } else {
            subscriber.next(input[i++]);
            if (!subscriber.closed) {
              this.schedule();
            }
          }
        });
      });
    }
    exports.scheduleArray = scheduleArray;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduled/scheduleIterable.js
var require_scheduleIterable = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduled/scheduleIterable.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.scheduleIterable = void 0;
    var Observable_1 = require_Observable();
    var iterator_1 = require_iterator();
    var isFunction_1 = require_isFunction();
    var executeSchedule_1 = require_executeSchedule();
    function scheduleIterable(input, scheduler) {
      return new Observable_1.Observable(function(subscriber) {
        var iterator;
        executeSchedule_1.executeSchedule(subscriber, scheduler, function() {
          iterator = input[iterator_1.iterator]();
          executeSchedule_1.executeSchedule(subscriber, scheduler, function() {
            var _a;
            var value;
            var done;
            try {
              _a = iterator.next(), value = _a.value, done = _a.done;
            } catch (err) {
              subscriber.error(err);
              return;
            }
            if (done) {
              subscriber.complete();
            } else {
              subscriber.next(value);
            }
          }, 0, true);
        });
        return function() {
          return isFunction_1.isFunction(iterator === null || iterator === void 0 ? void 0 : iterator.return) && iterator.return();
        };
      });
    }
    exports.scheduleIterable = scheduleIterable;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduled/scheduleAsyncIterable.js
var require_scheduleAsyncIterable = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduled/scheduleAsyncIterable.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.scheduleAsyncIterable = void 0;
    var Observable_1 = require_Observable();
    var executeSchedule_1 = require_executeSchedule();
    function scheduleAsyncIterable(input, scheduler) {
      if (!input) {
        throw new Error("Iterable cannot be null");
      }
      return new Observable_1.Observable(function(subscriber) {
        executeSchedule_1.executeSchedule(subscriber, scheduler, function() {
          var iterator = input[Symbol.asyncIterator]();
          executeSchedule_1.executeSchedule(subscriber, scheduler, function() {
            iterator.next().then(function(result) {
              if (result.done) {
                subscriber.complete();
              } else {
                subscriber.next(result.value);
              }
            });
          }, 0, true);
        });
      });
    }
    exports.scheduleAsyncIterable = scheduleAsyncIterable;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduled/scheduleReadableStreamLike.js
var require_scheduleReadableStreamLike = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduled/scheduleReadableStreamLike.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.scheduleReadableStreamLike = void 0;
    var scheduleAsyncIterable_1 = require_scheduleAsyncIterable();
    var isReadableStreamLike_1 = require_isReadableStreamLike();
    function scheduleReadableStreamLike(input, scheduler) {
      return scheduleAsyncIterable_1.scheduleAsyncIterable(isReadableStreamLike_1.readableStreamLikeToAsyncGenerator(input), scheduler);
    }
    exports.scheduleReadableStreamLike = scheduleReadableStreamLike;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduled/scheduled.js
var require_scheduled = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/scheduled/scheduled.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.scheduled = void 0;
    var scheduleObservable_1 = require_scheduleObservable();
    var schedulePromise_1 = require_schedulePromise();
    var scheduleArray_1 = require_scheduleArray();
    var scheduleIterable_1 = require_scheduleIterable();
    var scheduleAsyncIterable_1 = require_scheduleAsyncIterable();
    var isInteropObservable_1 = require_isInteropObservable();
    var isPromise_1 = require_isPromise();
    var isArrayLike_1 = require_isArrayLike();
    var isIterable_1 = require_isIterable();
    var isAsyncIterable_1 = require_isAsyncIterable();
    var throwUnobservableError_1 = require_throwUnobservableError();
    var isReadableStreamLike_1 = require_isReadableStreamLike();
    var scheduleReadableStreamLike_1 = require_scheduleReadableStreamLike();
    function scheduled(input, scheduler) {
      if (input != null) {
        if (isInteropObservable_1.isInteropObservable(input)) {
          return scheduleObservable_1.scheduleObservable(input, scheduler);
        }
        if (isArrayLike_1.isArrayLike(input)) {
          return scheduleArray_1.scheduleArray(input, scheduler);
        }
        if (isPromise_1.isPromise(input)) {
          return schedulePromise_1.schedulePromise(input, scheduler);
        }
        if (isAsyncIterable_1.isAsyncIterable(input)) {
          return scheduleAsyncIterable_1.scheduleAsyncIterable(input, scheduler);
        }
        if (isIterable_1.isIterable(input)) {
          return scheduleIterable_1.scheduleIterable(input, scheduler);
        }
        if (isReadableStreamLike_1.isReadableStreamLike(input)) {
          return scheduleReadableStreamLike_1.scheduleReadableStreamLike(input, scheduler);
        }
      }
      throw throwUnobservableError_1.createInvalidObservableTypeError(input);
    }
    exports.scheduled = scheduled;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/from.js
var require_from = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/from.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.from = void 0;
    var scheduled_1 = require_scheduled();
    var innerFrom_1 = require_innerFrom();
    function from(input, scheduler) {
      return scheduler ? scheduled_1.scheduled(input, scheduler) : innerFrom_1.innerFrom(input);
    }
    exports.from = from;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/of.js
var require_of = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/of.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.of = void 0;
    var args_1 = require_args();
    var from_1 = require_from();
    function of() {
      var args = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
      }
      var scheduler = args_1.popScheduler(args);
      return from_1.from(args, scheduler);
    }
    exports.of = of;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/throwError.js
var require_throwError = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/throwError.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.throwError = void 0;
    var Observable_1 = require_Observable();
    var isFunction_1 = require_isFunction();
    function throwError(errorOrErrorFactory, scheduler) {
      var errorFactory = isFunction_1.isFunction(errorOrErrorFactory) ? errorOrErrorFactory : function() {
        return errorOrErrorFactory;
      };
      var init = function(subscriber) {
        return subscriber.error(errorFactory());
      };
      return new Observable_1.Observable(scheduler ? function(subscriber) {
        return scheduler.schedule(init, 0, subscriber);
      } : init);
    }
    exports.throwError = throwError;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/Notification.js
var require_Notification = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/Notification.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.observeNotification = exports.Notification = exports.NotificationKind = void 0;
    var empty_1 = require_empty();
    var of_1 = require_of();
    var throwError_1 = require_throwError();
    var isFunction_1 = require_isFunction();
    var NotificationKind;
    (function(NotificationKind2) {
      NotificationKind2["NEXT"] = "N";
      NotificationKind2["ERROR"] = "E";
      NotificationKind2["COMPLETE"] = "C";
    })(NotificationKind = exports.NotificationKind || (exports.NotificationKind = {}));
    var Notification = (function() {
      function Notification2(kind, value, error) {
        this.kind = kind;
        this.value = value;
        this.error = error;
        this.hasValue = kind === "N";
      }
      Notification2.prototype.observe = function(observer) {
        return observeNotification(this, observer);
      };
      Notification2.prototype.do = function(nextHandler, errorHandler, completeHandler) {
        var _a = this, kind = _a.kind, value = _a.value, error = _a.error;
        return kind === "N" ? nextHandler === null || nextHandler === void 0 ? void 0 : nextHandler(value) : kind === "E" ? errorHandler === null || errorHandler === void 0 ? void 0 : errorHandler(error) : completeHandler === null || completeHandler === void 0 ? void 0 : completeHandler();
      };
      Notification2.prototype.accept = function(nextOrObserver, error, complete) {
        var _a;
        return isFunction_1.isFunction((_a = nextOrObserver) === null || _a === void 0 ? void 0 : _a.next) ? this.observe(nextOrObserver) : this.do(nextOrObserver, error, complete);
      };
      Notification2.prototype.toObservable = function() {
        var _a = this, kind = _a.kind, value = _a.value, error = _a.error;
        var result = kind === "N" ? of_1.of(value) : kind === "E" ? throwError_1.throwError(function() {
          return error;
        }) : kind === "C" ? empty_1.EMPTY : 0;
        if (!result) {
          throw new TypeError("Unexpected notification kind " + kind);
        }
        return result;
      };
      Notification2.createNext = function(value) {
        return new Notification2("N", value);
      };
      Notification2.createError = function(err) {
        return new Notification2("E", void 0, err);
      };
      Notification2.createComplete = function() {
        return Notification2.completeNotification;
      };
      Notification2.completeNotification = new Notification2("C");
      return Notification2;
    })();
    exports.Notification = Notification;
    function observeNotification(notification, observer) {
      var _a, _b, _c;
      var _d = notification, kind = _d.kind, value = _d.value, error = _d.error;
      if (typeof kind !== "string") {
        throw new TypeError('Invalid notification, missing "kind"');
      }
      kind === "N" ? (_a = observer.next) === null || _a === void 0 ? void 0 : _a.call(observer, value) : kind === "E" ? (_b = observer.error) === null || _b === void 0 ? void 0 : _b.call(observer, error) : (_c = observer.complete) === null || _c === void 0 ? void 0 : _c.call(observer);
    }
    exports.observeNotification = observeNotification;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isObservable.js
var require_isObservable = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isObservable.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isObservable = void 0;
    var Observable_1 = require_Observable();
    var isFunction_1 = require_isFunction();
    function isObservable(obj) {
      return !!obj && (obj instanceof Observable_1.Observable || isFunction_1.isFunction(obj.lift) && isFunction_1.isFunction(obj.subscribe));
    }
    exports.isObservable = isObservable;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/EmptyError.js
var require_EmptyError = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/EmptyError.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EmptyError = void 0;
    var createErrorClass_1 = require_createErrorClass();
    exports.EmptyError = createErrorClass_1.createErrorClass(function(_super) {
      return function EmptyErrorImpl() {
        _super(this);
        this.name = "EmptyError";
        this.message = "no elements in sequence";
      };
    });
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/lastValueFrom.js
var require_lastValueFrom = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/lastValueFrom.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.lastValueFrom = void 0;
    var EmptyError_1 = require_EmptyError();
    function lastValueFrom(source, config) {
      var hasConfig = typeof config === "object";
      return new Promise(function(resolve, reject) {
        var _hasValue = false;
        var _value;
        source.subscribe({
          next: function(value) {
            _value = value;
            _hasValue = true;
          },
          error: reject,
          complete: function() {
            if (_hasValue) {
              resolve(_value);
            } else if (hasConfig) {
              resolve(config.defaultValue);
            } else {
              reject(new EmptyError_1.EmptyError());
            }
          }
        });
      });
    }
    exports.lastValueFrom = lastValueFrom;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/firstValueFrom.js
var require_firstValueFrom = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/firstValueFrom.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.firstValueFrom = void 0;
    var EmptyError_1 = require_EmptyError();
    var Subscriber_1 = require_Subscriber();
    function firstValueFrom(source, config) {
      var hasConfig = typeof config === "object";
      return new Promise(function(resolve, reject) {
        var subscriber = new Subscriber_1.SafeSubscriber({
          next: function(value) {
            resolve(value);
            subscriber.unsubscribe();
          },
          error: reject,
          complete: function() {
            if (hasConfig) {
              resolve(config.defaultValue);
            } else {
              reject(new EmptyError_1.EmptyError());
            }
          }
        });
        source.subscribe(subscriber);
      });
    }
    exports.firstValueFrom = firstValueFrom;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/ArgumentOutOfRangeError.js
var require_ArgumentOutOfRangeError = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/ArgumentOutOfRangeError.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ArgumentOutOfRangeError = void 0;
    var createErrorClass_1 = require_createErrorClass();
    exports.ArgumentOutOfRangeError = createErrorClass_1.createErrorClass(function(_super) {
      return function ArgumentOutOfRangeErrorImpl() {
        _super(this);
        this.name = "ArgumentOutOfRangeError";
        this.message = "argument out of range";
      };
    });
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/NotFoundError.js
var require_NotFoundError = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/NotFoundError.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.NotFoundError = void 0;
    var createErrorClass_1 = require_createErrorClass();
    exports.NotFoundError = createErrorClass_1.createErrorClass(function(_super) {
      return function NotFoundErrorImpl(message) {
        _super(this);
        this.name = "NotFoundError";
        this.message = message;
      };
    });
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/SequenceError.js
var require_SequenceError = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/SequenceError.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SequenceError = void 0;
    var createErrorClass_1 = require_createErrorClass();
    exports.SequenceError = createErrorClass_1.createErrorClass(function(_super) {
      return function SequenceErrorImpl(message) {
        _super(this);
        this.name = "SequenceError";
        this.message = message;
      };
    });
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isDate.js
var require_isDate = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/isDate.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isValidDate = void 0;
    function isValidDate(value) {
      return value instanceof Date && !isNaN(value);
    }
    exports.isValidDate = isValidDate;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/timeout.js
var require_timeout = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/timeout.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.timeout = exports.TimeoutError = void 0;
    var async_1 = require_async();
    var isDate_1 = require_isDate();
    var lift_1 = require_lift();
    var innerFrom_1 = require_innerFrom();
    var createErrorClass_1 = require_createErrorClass();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var executeSchedule_1 = require_executeSchedule();
    exports.TimeoutError = createErrorClass_1.createErrorClass(function(_super) {
      return function TimeoutErrorImpl(info) {
        if (info === void 0) {
          info = null;
        }
        _super(this);
        this.message = "Timeout has occurred";
        this.name = "TimeoutError";
        this.info = info;
      };
    });
    function timeout(config, schedulerArg) {
      var _a = isDate_1.isValidDate(config) ? { first: config } : typeof config === "number" ? { each: config } : config, first = _a.first, each = _a.each, _b = _a.with, _with = _b === void 0 ? timeoutErrorFactory : _b, _c = _a.scheduler, scheduler = _c === void 0 ? schedulerArg !== null && schedulerArg !== void 0 ? schedulerArg : async_1.asyncScheduler : _c, _d = _a.meta, meta = _d === void 0 ? null : _d;
      if (first == null && each == null) {
        throw new TypeError("No timeout provided.");
      }
      return lift_1.operate(function(source, subscriber) {
        var originalSourceSubscription;
        var timerSubscription;
        var lastValue = null;
        var seen = 0;
        var startTimer = function(delay) {
          timerSubscription = executeSchedule_1.executeSchedule(subscriber, scheduler, function() {
            try {
              originalSourceSubscription.unsubscribe();
              innerFrom_1.innerFrom(_with({
                meta,
                lastValue,
                seen
              })).subscribe(subscriber);
            } catch (err) {
              subscriber.error(err);
            }
          }, delay);
        };
        originalSourceSubscription = source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          timerSubscription === null || timerSubscription === void 0 ? void 0 : timerSubscription.unsubscribe();
          seen++;
          subscriber.next(lastValue = value);
          each > 0 && startTimer(each);
        }, void 0, void 0, function() {
          if (!(timerSubscription === null || timerSubscription === void 0 ? void 0 : timerSubscription.closed)) {
            timerSubscription === null || timerSubscription === void 0 ? void 0 : timerSubscription.unsubscribe();
          }
          lastValue = null;
        }));
        !seen && startTimer(first != null ? typeof first === "number" ? first : +first - scheduler.now() : each);
      });
    }
    exports.timeout = timeout;
    function timeoutErrorFactory(info) {
      throw new exports.TimeoutError(info);
    }
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/map.js
var require_map = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/map.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.map = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function map(project, thisArg) {
      return lift_1.operate(function(source, subscriber) {
        var index = 0;
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          subscriber.next(project.call(thisArg, value, index++));
        }));
      });
    }
    exports.map = map;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/mapOneOrManyArgs.js
var require_mapOneOrManyArgs = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/mapOneOrManyArgs.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.mapOneOrManyArgs = void 0;
    var map_1 = require_map();
    var isArray = Array.isArray;
    function callOrApply(fn, args) {
      return isArray(args) ? fn.apply(void 0, __spreadArray([], __read(args))) : fn(args);
    }
    function mapOneOrManyArgs(fn) {
      return map_1.map(function(args) {
        return callOrApply(fn, args);
      });
    }
    exports.mapOneOrManyArgs = mapOneOrManyArgs;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/bindCallbackInternals.js
var require_bindCallbackInternals = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/bindCallbackInternals.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.bindCallbackInternals = void 0;
    var isScheduler_1 = require_isScheduler();
    var Observable_1 = require_Observable();
    var subscribeOn_1 = require_subscribeOn();
    var mapOneOrManyArgs_1 = require_mapOneOrManyArgs();
    var observeOn_1 = require_observeOn();
    var AsyncSubject_1 = require_AsyncSubject();
    function bindCallbackInternals(isNodeStyle, callbackFunc, resultSelector, scheduler) {
      if (resultSelector) {
        if (isScheduler_1.isScheduler(resultSelector)) {
          scheduler = resultSelector;
        } else {
          return function() {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
              args[_i] = arguments[_i];
            }
            return bindCallbackInternals(isNodeStyle, callbackFunc, scheduler).apply(this, args).pipe(mapOneOrManyArgs_1.mapOneOrManyArgs(resultSelector));
          };
        }
      }
      if (scheduler) {
        return function() {
          var args = [];
          for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
          }
          return bindCallbackInternals(isNodeStyle, callbackFunc).apply(this, args).pipe(subscribeOn_1.subscribeOn(scheduler), observeOn_1.observeOn(scheduler));
        };
      }
      return function() {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
          args[_i] = arguments[_i];
        }
        var subject = new AsyncSubject_1.AsyncSubject();
        var uninitialized = true;
        return new Observable_1.Observable(function(subscriber) {
          var subs = subject.subscribe(subscriber);
          if (uninitialized) {
            uninitialized = false;
            var isAsync_1 = false;
            var isComplete_1 = false;
            callbackFunc.apply(_this, __spreadArray(__spreadArray([], __read(args)), [
              function() {
                var results = [];
                for (var _i2 = 0; _i2 < arguments.length; _i2++) {
                  results[_i2] = arguments[_i2];
                }
                if (isNodeStyle) {
                  var err = results.shift();
                  if (err != null) {
                    subject.error(err);
                    return;
                  }
                }
                subject.next(1 < results.length ? results : results[0]);
                isComplete_1 = true;
                if (isAsync_1) {
                  subject.complete();
                }
              }
            ]));
            if (isComplete_1) {
              subject.complete();
            }
            isAsync_1 = true;
          }
          return subs;
        });
      };
    }
    exports.bindCallbackInternals = bindCallbackInternals;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/bindCallback.js
var require_bindCallback = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/bindCallback.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.bindCallback = void 0;
    var bindCallbackInternals_1 = require_bindCallbackInternals();
    function bindCallback(callbackFunc, resultSelector, scheduler) {
      return bindCallbackInternals_1.bindCallbackInternals(false, callbackFunc, resultSelector, scheduler);
    }
    exports.bindCallback = bindCallback;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/bindNodeCallback.js
var require_bindNodeCallback = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/bindNodeCallback.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.bindNodeCallback = void 0;
    var bindCallbackInternals_1 = require_bindCallbackInternals();
    function bindNodeCallback(callbackFunc, resultSelector, scheduler) {
      return bindCallbackInternals_1.bindCallbackInternals(true, callbackFunc, resultSelector, scheduler);
    }
    exports.bindNodeCallback = bindNodeCallback;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/argsArgArrayOrObject.js
var require_argsArgArrayOrObject = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/argsArgArrayOrObject.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.argsArgArrayOrObject = void 0;
    var isArray = Array.isArray;
    var getPrototypeOf = Object.getPrototypeOf;
    var objectProto = Object.prototype;
    var getKeys = Object.keys;
    function argsArgArrayOrObject(args) {
      if (args.length === 1) {
        var first_1 = args[0];
        if (isArray(first_1)) {
          return { args: first_1, keys: null };
        }
        if (isPOJO(first_1)) {
          var keys = getKeys(first_1);
          return {
            args: keys.map(function(key) {
              return first_1[key];
            }),
            keys
          };
        }
      }
      return { args, keys: null };
    }
    exports.argsArgArrayOrObject = argsArgArrayOrObject;
    function isPOJO(obj) {
      return obj && typeof obj === "object" && getPrototypeOf(obj) === objectProto;
    }
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/createObject.js
var require_createObject = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/createObject.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createObject = void 0;
    function createObject(keys, values) {
      return keys.reduce(function(result, key, i) {
        return result[key] = values[i], result;
      }, {});
    }
    exports.createObject = createObject;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/combineLatest.js
var require_combineLatest = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/combineLatest.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.combineLatestInit = exports.combineLatest = void 0;
    var Observable_1 = require_Observable();
    var argsArgArrayOrObject_1 = require_argsArgArrayOrObject();
    var from_1 = require_from();
    var identity_1 = require_identity();
    var mapOneOrManyArgs_1 = require_mapOneOrManyArgs();
    var args_1 = require_args();
    var createObject_1 = require_createObject();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var executeSchedule_1 = require_executeSchedule();
    function combineLatest() {
      var args = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
      }
      var scheduler = args_1.popScheduler(args);
      var resultSelector = args_1.popResultSelector(args);
      var _a = argsArgArrayOrObject_1.argsArgArrayOrObject(args), observables = _a.args, keys = _a.keys;
      if (observables.length === 0) {
        return from_1.from([], scheduler);
      }
      var result = new Observable_1.Observable(combineLatestInit(observables, scheduler, keys ? function(values) {
        return createObject_1.createObject(keys, values);
      } : identity_1.identity));
      return resultSelector ? result.pipe(mapOneOrManyArgs_1.mapOneOrManyArgs(resultSelector)) : result;
    }
    exports.combineLatest = combineLatest;
    function combineLatestInit(observables, scheduler, valueTransform) {
      if (valueTransform === void 0) {
        valueTransform = identity_1.identity;
      }
      return function(subscriber) {
        maybeSchedule(scheduler, function() {
          var length = observables.length;
          var values = new Array(length);
          var active = length;
          var remainingFirstValues = length;
          var _loop_1 = function(i2) {
            maybeSchedule(scheduler, function() {
              var source = from_1.from(observables[i2], scheduler);
              var hasFirstValue = false;
              source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
                values[i2] = value;
                if (!hasFirstValue) {
                  hasFirstValue = true;
                  remainingFirstValues--;
                }
                if (!remainingFirstValues) {
                  subscriber.next(valueTransform(values.slice()));
                }
              }, function() {
                if (!--active) {
                  subscriber.complete();
                }
              }));
            }, subscriber);
          };
          for (var i = 0; i < length; i++) {
            _loop_1(i);
          }
        }, subscriber);
      };
    }
    exports.combineLatestInit = combineLatestInit;
    function maybeSchedule(scheduler, execute, subscription) {
      if (scheduler) {
        executeSchedule_1.executeSchedule(subscription, scheduler, execute);
      } else {
        execute();
      }
    }
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/mergeInternals.js
var require_mergeInternals = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/mergeInternals.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.mergeInternals = void 0;
    var innerFrom_1 = require_innerFrom();
    var executeSchedule_1 = require_executeSchedule();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function mergeInternals(source, subscriber, project, concurrent, onBeforeNext, expand, innerSubScheduler, additionalFinalizer) {
      var buffer = [];
      var active = 0;
      var index = 0;
      var isComplete = false;
      var checkComplete = function() {
        if (isComplete && !buffer.length && !active) {
          subscriber.complete();
        }
      };
      var outerNext = function(value) {
        return active < concurrent ? doInnerSub(value) : buffer.push(value);
      };
      var doInnerSub = function(value) {
        expand && subscriber.next(value);
        active++;
        var innerComplete = false;
        innerFrom_1.innerFrom(project(value, index++)).subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(innerValue) {
          onBeforeNext === null || onBeforeNext === void 0 ? void 0 : onBeforeNext(innerValue);
          if (expand) {
            outerNext(innerValue);
          } else {
            subscriber.next(innerValue);
          }
        }, function() {
          innerComplete = true;
        }, void 0, function() {
          if (innerComplete) {
            try {
              active--;
              var _loop_1 = function() {
                var bufferedValue = buffer.shift();
                if (innerSubScheduler) {
                  executeSchedule_1.executeSchedule(subscriber, innerSubScheduler, function() {
                    return doInnerSub(bufferedValue);
                  });
                } else {
                  doInnerSub(bufferedValue);
                }
              };
              while (buffer.length && active < concurrent) {
                _loop_1();
              }
              checkComplete();
            } catch (err) {
              subscriber.error(err);
            }
          }
        }));
      };
      source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, outerNext, function() {
        isComplete = true;
        checkComplete();
      }));
      return function() {
        additionalFinalizer === null || additionalFinalizer === void 0 ? void 0 : additionalFinalizer();
      };
    }
    exports.mergeInternals = mergeInternals;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/mergeMap.js
var require_mergeMap = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/mergeMap.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.mergeMap = void 0;
    var map_1 = require_map();
    var innerFrom_1 = require_innerFrom();
    var lift_1 = require_lift();
    var mergeInternals_1 = require_mergeInternals();
    var isFunction_1 = require_isFunction();
    function mergeMap(project, resultSelector, concurrent) {
      if (concurrent === void 0) {
        concurrent = Infinity;
      }
      if (isFunction_1.isFunction(resultSelector)) {
        return mergeMap(function(a2, i) {
          return map_1.map(function(b2, ii) {
            return resultSelector(a2, b2, i, ii);
          })(innerFrom_1.innerFrom(project(a2, i)));
        }, concurrent);
      } else if (typeof resultSelector === "number") {
        concurrent = resultSelector;
      }
      return lift_1.operate(function(source, subscriber) {
        return mergeInternals_1.mergeInternals(source, subscriber, project, concurrent);
      });
    }
    exports.mergeMap = mergeMap;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/mergeAll.js
var require_mergeAll = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/mergeAll.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.mergeAll = void 0;
    var mergeMap_1 = require_mergeMap();
    var identity_1 = require_identity();
    function mergeAll(concurrent) {
      if (concurrent === void 0) {
        concurrent = Infinity;
      }
      return mergeMap_1.mergeMap(identity_1.identity, concurrent);
    }
    exports.mergeAll = mergeAll;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/concatAll.js
var require_concatAll = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/concatAll.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.concatAll = void 0;
    var mergeAll_1 = require_mergeAll();
    function concatAll() {
      return mergeAll_1.mergeAll(1);
    }
    exports.concatAll = concatAll;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/concat.js
var require_concat = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/concat.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.concat = void 0;
    var concatAll_1 = require_concatAll();
    var args_1 = require_args();
    var from_1 = require_from();
    function concat() {
      var args = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
      }
      return concatAll_1.concatAll()(from_1.from(args, args_1.popScheduler(args)));
    }
    exports.concat = concat;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/defer.js
var require_defer = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/defer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.defer = void 0;
    var Observable_1 = require_Observable();
    var innerFrom_1 = require_innerFrom();
    function defer(observableFactory) {
      return new Observable_1.Observable(function(subscriber) {
        innerFrom_1.innerFrom(observableFactory()).subscribe(subscriber);
      });
    }
    exports.defer = defer;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/connectable.js
var require_connectable = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/connectable.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.connectable = void 0;
    var Subject_1 = require_Subject();
    var Observable_1 = require_Observable();
    var defer_1 = require_defer();
    var DEFAULT_CONFIG = {
      connector: function() {
        return new Subject_1.Subject();
      },
      resetOnDisconnect: true
    };
    function connectable(source, config) {
      if (config === void 0) {
        config = DEFAULT_CONFIG;
      }
      var connection = null;
      var connector = config.connector, _a = config.resetOnDisconnect, resetOnDisconnect = _a === void 0 ? true : _a;
      var subject = connector();
      var result = new Observable_1.Observable(function(subscriber) {
        return subject.subscribe(subscriber);
      });
      result.connect = function() {
        if (!connection || connection.closed) {
          connection = defer_1.defer(function() {
            return source;
          }).subscribe(subject);
          if (resetOnDisconnect) {
            connection.add(function() {
              return subject = connector();
            });
          }
        }
        return connection;
      };
      return result;
    }
    exports.connectable = connectable;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/forkJoin.js
var require_forkJoin = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/forkJoin.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.forkJoin = void 0;
    var Observable_1 = require_Observable();
    var argsArgArrayOrObject_1 = require_argsArgArrayOrObject();
    var innerFrom_1 = require_innerFrom();
    var args_1 = require_args();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var mapOneOrManyArgs_1 = require_mapOneOrManyArgs();
    var createObject_1 = require_createObject();
    function forkJoin() {
      var args = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
      }
      var resultSelector = args_1.popResultSelector(args);
      var _a = argsArgArrayOrObject_1.argsArgArrayOrObject(args), sources = _a.args, keys = _a.keys;
      var result = new Observable_1.Observable(function(subscriber) {
        var length = sources.length;
        if (!length) {
          subscriber.complete();
          return;
        }
        var values = new Array(length);
        var remainingCompletions = length;
        var remainingEmissions = length;
        var _loop_1 = function(sourceIndex2) {
          var hasValue = false;
          innerFrom_1.innerFrom(sources[sourceIndex2]).subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
            if (!hasValue) {
              hasValue = true;
              remainingEmissions--;
            }
            values[sourceIndex2] = value;
          }, function() {
            return remainingCompletions--;
          }, void 0, function() {
            if (!remainingCompletions || !hasValue) {
              if (!remainingEmissions) {
                subscriber.next(keys ? createObject_1.createObject(keys, values) : values);
              }
              subscriber.complete();
            }
          }));
        };
        for (var sourceIndex = 0; sourceIndex < length; sourceIndex++) {
          _loop_1(sourceIndex);
        }
      });
      return resultSelector ? result.pipe(mapOneOrManyArgs_1.mapOneOrManyArgs(resultSelector)) : result;
    }
    exports.forkJoin = forkJoin;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/fromEvent.js
var require_fromEvent = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/fromEvent.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.fromEvent = void 0;
    var innerFrom_1 = require_innerFrom();
    var Observable_1 = require_Observable();
    var mergeMap_1 = require_mergeMap();
    var isArrayLike_1 = require_isArrayLike();
    var isFunction_1 = require_isFunction();
    var mapOneOrManyArgs_1 = require_mapOneOrManyArgs();
    var nodeEventEmitterMethods = ["addListener", "removeListener"];
    var eventTargetMethods = ["addEventListener", "removeEventListener"];
    var jqueryMethods = ["on", "off"];
    function fromEvent(target, eventName, options, resultSelector) {
      if (isFunction_1.isFunction(options)) {
        resultSelector = options;
        options = void 0;
      }
      if (resultSelector) {
        return fromEvent(target, eventName, options).pipe(mapOneOrManyArgs_1.mapOneOrManyArgs(resultSelector));
      }
      var _a = __read(isEventTarget(target) ? eventTargetMethods.map(function(methodName) {
        return function(handler) {
          return target[methodName](eventName, handler, options);
        };
      }) : isNodeStyleEventEmitter(target) ? nodeEventEmitterMethods.map(toCommonHandlerRegistry(target, eventName)) : isJQueryStyleEventEmitter(target) ? jqueryMethods.map(toCommonHandlerRegistry(target, eventName)) : [], 2), add = _a[0], remove = _a[1];
      if (!add) {
        if (isArrayLike_1.isArrayLike(target)) {
          return mergeMap_1.mergeMap(function(subTarget) {
            return fromEvent(subTarget, eventName, options);
          })(innerFrom_1.innerFrom(target));
        }
      }
      if (!add) {
        throw new TypeError("Invalid event target");
      }
      return new Observable_1.Observable(function(subscriber) {
        var handler = function() {
          var args = [];
          for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
          }
          return subscriber.next(1 < args.length ? args : args[0]);
        };
        add(handler);
        return function() {
          return remove(handler);
        };
      });
    }
    exports.fromEvent = fromEvent;
    function toCommonHandlerRegistry(target, eventName) {
      return function(methodName) {
        return function(handler) {
          return target[methodName](eventName, handler);
        };
      };
    }
    function isNodeStyleEventEmitter(target) {
      return isFunction_1.isFunction(target.addListener) && isFunction_1.isFunction(target.removeListener);
    }
    function isJQueryStyleEventEmitter(target) {
      return isFunction_1.isFunction(target.on) && isFunction_1.isFunction(target.off);
    }
    function isEventTarget(target) {
      return isFunction_1.isFunction(target.addEventListener) && isFunction_1.isFunction(target.removeEventListener);
    }
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/fromEventPattern.js
var require_fromEventPattern = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/fromEventPattern.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.fromEventPattern = void 0;
    var Observable_1 = require_Observable();
    var isFunction_1 = require_isFunction();
    var mapOneOrManyArgs_1 = require_mapOneOrManyArgs();
    function fromEventPattern(addHandler, removeHandler, resultSelector) {
      if (resultSelector) {
        return fromEventPattern(addHandler, removeHandler).pipe(mapOneOrManyArgs_1.mapOneOrManyArgs(resultSelector));
      }
      return new Observable_1.Observable(function(subscriber) {
        var handler = function() {
          var e = [];
          for (var _i = 0; _i < arguments.length; _i++) {
            e[_i] = arguments[_i];
          }
          return subscriber.next(e.length === 1 ? e[0] : e);
        };
        var retValue = addHandler(handler);
        return isFunction_1.isFunction(removeHandler) ? function() {
          return removeHandler(handler, retValue);
        } : void 0;
      });
    }
    exports.fromEventPattern = fromEventPattern;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/generate.js
var require_generate = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/generate.js"(exports) {
    "use strict";
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _2 = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f2, y2, t, g2;
      return g2 = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g2[Symbol.iterator] = function() {
        return this;
      }), g2;
      function verb(n) {
        return function(v2) {
          return step([n, v2]);
        };
      }
      function step(op) {
        if (f2) throw new TypeError("Generator is already executing.");
        while (_2) try {
          if (f2 = 1, y2 && (t = op[0] & 2 ? y2["return"] : op[0] ? y2["throw"] || ((t = y2["return"]) && t.call(y2), 0) : y2.next) && !(t = t.call(y2, op[1])).done) return t;
          if (y2 = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _2.label++;
              return { value: op[1], done: false };
            case 5:
              _2.label++;
              y2 = op[1];
              op = [0];
              continue;
            case 7:
              op = _2.ops.pop();
              _2.trys.pop();
              continue;
            default:
              if (!(t = _2.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _2 = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _2.label = op[1];
                break;
              }
              if (op[0] === 6 && _2.label < t[1]) {
                _2.label = t[1];
                t = op;
                break;
              }
              if (t && _2.label < t[2]) {
                _2.label = t[2];
                _2.ops.push(op);
                break;
              }
              if (t[2]) _2.ops.pop();
              _2.trys.pop();
              continue;
          }
          op = body.call(thisArg, _2);
        } catch (e) {
          op = [6, e];
          y2 = 0;
        } finally {
          f2 = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.generate = void 0;
    var identity_1 = require_identity();
    var isScheduler_1 = require_isScheduler();
    var defer_1 = require_defer();
    var scheduleIterable_1 = require_scheduleIterable();
    function generate(initialStateOrOptions, condition, iterate, resultSelectorOrScheduler, scheduler) {
      var _a, _b;
      var resultSelector;
      var initialState;
      if (arguments.length === 1) {
        _a = initialStateOrOptions, initialState = _a.initialState, condition = _a.condition, iterate = _a.iterate, _b = _a.resultSelector, resultSelector = _b === void 0 ? identity_1.identity : _b, scheduler = _a.scheduler;
      } else {
        initialState = initialStateOrOptions;
        if (!resultSelectorOrScheduler || isScheduler_1.isScheduler(resultSelectorOrScheduler)) {
          resultSelector = identity_1.identity;
          scheduler = resultSelectorOrScheduler;
        } else {
          resultSelector = resultSelectorOrScheduler;
        }
      }
      function gen() {
        var state;
        return __generator(this, function(_a2) {
          switch (_a2.label) {
            case 0:
              state = initialState;
              _a2.label = 1;
            case 1:
              if (!(!condition || condition(state))) return [3, 4];
              return [4, resultSelector(state)];
            case 2:
              _a2.sent();
              _a2.label = 3;
            case 3:
              state = iterate(state);
              return [3, 1];
            case 4:
              return [2];
          }
        });
      }
      return defer_1.defer(scheduler ? function() {
        return scheduleIterable_1.scheduleIterable(gen(), scheduler);
      } : gen);
    }
    exports.generate = generate;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/iif.js
var require_iif = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/iif.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.iif = void 0;
    var defer_1 = require_defer();
    function iif(condition, trueResult, falseResult) {
      return defer_1.defer(function() {
        return condition() ? trueResult : falseResult;
      });
    }
    exports.iif = iif;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/timer.js
var require_timer = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/timer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.timer = void 0;
    var Observable_1 = require_Observable();
    var async_1 = require_async();
    var isScheduler_1 = require_isScheduler();
    var isDate_1 = require_isDate();
    function timer(dueTime, intervalOrScheduler, scheduler) {
      if (dueTime === void 0) {
        dueTime = 0;
      }
      if (scheduler === void 0) {
        scheduler = async_1.async;
      }
      var intervalDuration = -1;
      if (intervalOrScheduler != null) {
        if (isScheduler_1.isScheduler(intervalOrScheduler)) {
          scheduler = intervalOrScheduler;
        } else {
          intervalDuration = intervalOrScheduler;
        }
      }
      return new Observable_1.Observable(function(subscriber) {
        var due = isDate_1.isValidDate(dueTime) ? +dueTime - scheduler.now() : dueTime;
        if (due < 0) {
          due = 0;
        }
        var n = 0;
        return scheduler.schedule(function() {
          if (!subscriber.closed) {
            subscriber.next(n++);
            if (0 <= intervalDuration) {
              this.schedule(void 0, intervalDuration);
            } else {
              subscriber.complete();
            }
          }
        }, due);
      });
    }
    exports.timer = timer;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/interval.js
var require_interval = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/interval.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.interval = void 0;
    var async_1 = require_async();
    var timer_1 = require_timer();
    function interval(period, scheduler) {
      if (period === void 0) {
        period = 0;
      }
      if (scheduler === void 0) {
        scheduler = async_1.asyncScheduler;
      }
      if (period < 0) {
        period = 0;
      }
      return timer_1.timer(period, period, scheduler);
    }
    exports.interval = interval;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/merge.js
var require_merge = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/merge.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.merge = void 0;
    var mergeAll_1 = require_mergeAll();
    var innerFrom_1 = require_innerFrom();
    var empty_1 = require_empty();
    var args_1 = require_args();
    var from_1 = require_from();
    function merge() {
      var args = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
      }
      var scheduler = args_1.popScheduler(args);
      var concurrent = args_1.popNumber(args, Infinity);
      var sources = args;
      return !sources.length ? empty_1.EMPTY : sources.length === 1 ? innerFrom_1.innerFrom(sources[0]) : mergeAll_1.mergeAll(concurrent)(from_1.from(sources, scheduler));
    }
    exports.merge = merge;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/never.js
var require_never = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/never.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.never = exports.NEVER = void 0;
    var Observable_1 = require_Observable();
    var noop_1 = require_noop();
    exports.NEVER = new Observable_1.Observable(noop_1.noop);
    function never() {
      return exports.NEVER;
    }
    exports.never = never;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/argsOrArgArray.js
var require_argsOrArgArray = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/argsOrArgArray.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.argsOrArgArray = void 0;
    var isArray = Array.isArray;
    function argsOrArgArray(args) {
      return args.length === 1 && isArray(args[0]) ? args[0] : args;
    }
    exports.argsOrArgArray = argsOrArgArray;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/onErrorResumeNext.js
var require_onErrorResumeNext = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/onErrorResumeNext.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.onErrorResumeNext = void 0;
    var Observable_1 = require_Observable();
    var argsOrArgArray_1 = require_argsOrArgArray();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var noop_1 = require_noop();
    var innerFrom_1 = require_innerFrom();
    function onErrorResumeNext() {
      var sources = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        sources[_i] = arguments[_i];
      }
      var nextSources = argsOrArgArray_1.argsOrArgArray(sources);
      return new Observable_1.Observable(function(subscriber) {
        var sourceIndex = 0;
        var subscribeNext = function() {
          if (sourceIndex < nextSources.length) {
            var nextSource = void 0;
            try {
              nextSource = innerFrom_1.innerFrom(nextSources[sourceIndex++]);
            } catch (err) {
              subscribeNext();
              return;
            }
            var innerSubscriber = new OperatorSubscriber_1.OperatorSubscriber(subscriber, void 0, noop_1.noop, noop_1.noop);
            nextSource.subscribe(innerSubscriber);
            innerSubscriber.add(subscribeNext);
          } else {
            subscriber.complete();
          }
        };
        subscribeNext();
      });
    }
    exports.onErrorResumeNext = onErrorResumeNext;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/pairs.js
var require_pairs = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/pairs.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.pairs = void 0;
    var from_1 = require_from();
    function pairs(obj, scheduler) {
      return from_1.from(Object.entries(obj), scheduler);
    }
    exports.pairs = pairs;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/not.js
var require_not = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/util/not.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.not = void 0;
    function not(pred, thisArg) {
      return function(value, index) {
        return !pred.call(thisArg, value, index);
      };
    }
    exports.not = not;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/filter.js
var require_filter = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/filter.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.filter = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function filter(predicate, thisArg) {
      return lift_1.operate(function(source, subscriber) {
        var index = 0;
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          return predicate.call(thisArg, value, index++) && subscriber.next(value);
        }));
      });
    }
    exports.filter = filter;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/partition.js
var require_partition = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/partition.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.partition = void 0;
    var not_1 = require_not();
    var filter_1 = require_filter();
    var innerFrom_1 = require_innerFrom();
    function partition(source, predicate, thisArg) {
      return [filter_1.filter(predicate, thisArg)(innerFrom_1.innerFrom(source)), filter_1.filter(not_1.not(predicate, thisArg))(innerFrom_1.innerFrom(source))];
    }
    exports.partition = partition;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/race.js
var require_race = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/race.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.raceInit = exports.race = void 0;
    var Observable_1 = require_Observable();
    var innerFrom_1 = require_innerFrom();
    var argsOrArgArray_1 = require_argsOrArgArray();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function race() {
      var sources = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        sources[_i] = arguments[_i];
      }
      sources = argsOrArgArray_1.argsOrArgArray(sources);
      return sources.length === 1 ? innerFrom_1.innerFrom(sources[0]) : new Observable_1.Observable(raceInit(sources));
    }
    exports.race = race;
    function raceInit(sources) {
      return function(subscriber) {
        var subscriptions = [];
        var _loop_1 = function(i2) {
          subscriptions.push(innerFrom_1.innerFrom(sources[i2]).subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
            if (subscriptions) {
              for (var s2 = 0; s2 < subscriptions.length; s2++) {
                s2 !== i2 && subscriptions[s2].unsubscribe();
              }
              subscriptions = null;
            }
            subscriber.next(value);
          })));
        };
        for (var i = 0; subscriptions && !subscriber.closed && i < sources.length; i++) {
          _loop_1(i);
        }
      };
    }
    exports.raceInit = raceInit;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/range.js
var require_range = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/range.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.range = void 0;
    var Observable_1 = require_Observable();
    var empty_1 = require_empty();
    function range(start, count, scheduler) {
      if (count == null) {
        count = start;
        start = 0;
      }
      if (count <= 0) {
        return empty_1.EMPTY;
      }
      var end = count + start;
      return new Observable_1.Observable(scheduler ? function(subscriber) {
        var n = start;
        return scheduler.schedule(function() {
          if (n < end) {
            subscriber.next(n++);
            this.schedule();
          } else {
            subscriber.complete();
          }
        });
      } : function(subscriber) {
        var n = start;
        while (n < end && !subscriber.closed) {
          subscriber.next(n++);
        }
        subscriber.complete();
      });
    }
    exports.range = range;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/using.js
var require_using = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/using.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.using = void 0;
    var Observable_1 = require_Observable();
    var innerFrom_1 = require_innerFrom();
    var empty_1 = require_empty();
    function using(resourceFactory, observableFactory) {
      return new Observable_1.Observable(function(subscriber) {
        var resource = resourceFactory();
        var result = observableFactory(resource);
        var source = result ? innerFrom_1.innerFrom(result) : empty_1.EMPTY;
        source.subscribe(subscriber);
        return function() {
          if (resource) {
            resource.unsubscribe();
          }
        };
      });
    }
    exports.using = using;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/zip.js
var require_zip = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/zip.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.zip = void 0;
    var Observable_1 = require_Observable();
    var innerFrom_1 = require_innerFrom();
    var argsOrArgArray_1 = require_argsOrArgArray();
    var empty_1 = require_empty();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var args_1 = require_args();
    function zip() {
      var args = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
      }
      var resultSelector = args_1.popResultSelector(args);
      var sources = argsOrArgArray_1.argsOrArgArray(args);
      return sources.length ? new Observable_1.Observable(function(subscriber) {
        var buffers = sources.map(function() {
          return [];
        });
        var completed = sources.map(function() {
          return false;
        });
        subscriber.add(function() {
          buffers = completed = null;
        });
        var _loop_1 = function(sourceIndex2) {
          innerFrom_1.innerFrom(sources[sourceIndex2]).subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
            buffers[sourceIndex2].push(value);
            if (buffers.every(function(buffer) {
              return buffer.length;
            })) {
              var result = buffers.map(function(buffer) {
                return buffer.shift();
              });
              subscriber.next(resultSelector ? resultSelector.apply(void 0, __spreadArray([], __read(result))) : result);
              if (buffers.some(function(buffer, i) {
                return !buffer.length && completed[i];
              })) {
                subscriber.complete();
              }
            }
          }, function() {
            completed[sourceIndex2] = true;
            !buffers[sourceIndex2].length && subscriber.complete();
          }));
        };
        for (var sourceIndex = 0; !subscriber.closed && sourceIndex < sources.length; sourceIndex++) {
          _loop_1(sourceIndex);
        }
        return function() {
          buffers = completed = null;
        };
      }) : empty_1.EMPTY;
    }
    exports.zip = zip;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/types.js
var require_types = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/audit.js
var require_audit = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/audit.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.audit = void 0;
    var lift_1 = require_lift();
    var innerFrom_1 = require_innerFrom();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function audit(durationSelector) {
      return lift_1.operate(function(source, subscriber) {
        var hasValue = false;
        var lastValue = null;
        var durationSubscriber = null;
        var isComplete = false;
        var endDuration = function() {
          durationSubscriber === null || durationSubscriber === void 0 ? void 0 : durationSubscriber.unsubscribe();
          durationSubscriber = null;
          if (hasValue) {
            hasValue = false;
            var value = lastValue;
            lastValue = null;
            subscriber.next(value);
          }
          isComplete && subscriber.complete();
        };
        var cleanupDuration = function() {
          durationSubscriber = null;
          isComplete && subscriber.complete();
        };
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          hasValue = true;
          lastValue = value;
          if (!durationSubscriber) {
            innerFrom_1.innerFrom(durationSelector(value)).subscribe(durationSubscriber = OperatorSubscriber_1.createOperatorSubscriber(subscriber, endDuration, cleanupDuration));
          }
        }, function() {
          isComplete = true;
          (!hasValue || !durationSubscriber || durationSubscriber.closed) && subscriber.complete();
        }));
      });
    }
    exports.audit = audit;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/auditTime.js
var require_auditTime = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/auditTime.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.auditTime = void 0;
    var async_1 = require_async();
    var audit_1 = require_audit();
    var timer_1 = require_timer();
    function auditTime(duration, scheduler) {
      if (scheduler === void 0) {
        scheduler = async_1.asyncScheduler;
      }
      return audit_1.audit(function() {
        return timer_1.timer(duration, scheduler);
      });
    }
    exports.auditTime = auditTime;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/buffer.js
var require_buffer = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/buffer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.buffer = void 0;
    var lift_1 = require_lift();
    var noop_1 = require_noop();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var innerFrom_1 = require_innerFrom();
    function buffer(closingNotifier) {
      return lift_1.operate(function(source, subscriber) {
        var currentBuffer = [];
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          return currentBuffer.push(value);
        }, function() {
          subscriber.next(currentBuffer);
          subscriber.complete();
        }));
        innerFrom_1.innerFrom(closingNotifier).subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function() {
          var b2 = currentBuffer;
          currentBuffer = [];
          subscriber.next(b2);
        }, noop_1.noop));
        return function() {
          currentBuffer = null;
        };
      });
    }
    exports.buffer = buffer;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/bufferCount.js
var require_bufferCount = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/bufferCount.js"(exports) {
    "use strict";
    var __values = exports && exports.__values || function(o2) {
      var s2 = typeof Symbol === "function" && Symbol.iterator, m2 = s2 && o2[s2], i = 0;
      if (m2) return m2.call(o2);
      if (o2 && typeof o2.length === "number") return {
        next: function() {
          if (o2 && i >= o2.length) o2 = void 0;
          return { value: o2 && o2[i++], done: !o2 };
        }
      };
      throw new TypeError(s2 ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.bufferCount = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var arrRemove_1 = require_arrRemove();
    function bufferCount(bufferSize, startBufferEvery) {
      if (startBufferEvery === void 0) {
        startBufferEvery = null;
      }
      startBufferEvery = startBufferEvery !== null && startBufferEvery !== void 0 ? startBufferEvery : bufferSize;
      return lift_1.operate(function(source, subscriber) {
        var buffers = [];
        var count = 0;
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          var e_1, _a, e_2, _b;
          var toEmit = null;
          if (count++ % startBufferEvery === 0) {
            buffers.push([]);
          }
          try {
            for (var buffers_1 = __values(buffers), buffers_1_1 = buffers_1.next(); !buffers_1_1.done; buffers_1_1 = buffers_1.next()) {
              var buffer = buffers_1_1.value;
              buffer.push(value);
              if (bufferSize <= buffer.length) {
                toEmit = toEmit !== null && toEmit !== void 0 ? toEmit : [];
                toEmit.push(buffer);
              }
            }
          } catch (e_1_1) {
            e_1 = { error: e_1_1 };
          } finally {
            try {
              if (buffers_1_1 && !buffers_1_1.done && (_a = buffers_1.return)) _a.call(buffers_1);
            } finally {
              if (e_1) throw e_1.error;
            }
          }
          if (toEmit) {
            try {
              for (var toEmit_1 = __values(toEmit), toEmit_1_1 = toEmit_1.next(); !toEmit_1_1.done; toEmit_1_1 = toEmit_1.next()) {
                var buffer = toEmit_1_1.value;
                arrRemove_1.arrRemove(buffers, buffer);
                subscriber.next(buffer);
              }
            } catch (e_2_1) {
              e_2 = { error: e_2_1 };
            } finally {
              try {
                if (toEmit_1_1 && !toEmit_1_1.done && (_b = toEmit_1.return)) _b.call(toEmit_1);
              } finally {
                if (e_2) throw e_2.error;
              }
            }
          }
        }, function() {
          var e_3, _a;
          try {
            for (var buffers_2 = __values(buffers), buffers_2_1 = buffers_2.next(); !buffers_2_1.done; buffers_2_1 = buffers_2.next()) {
              var buffer = buffers_2_1.value;
              subscriber.next(buffer);
            }
          } catch (e_3_1) {
            e_3 = { error: e_3_1 };
          } finally {
            try {
              if (buffers_2_1 && !buffers_2_1.done && (_a = buffers_2.return)) _a.call(buffers_2);
            } finally {
              if (e_3) throw e_3.error;
            }
          }
          subscriber.complete();
        }, void 0, function() {
          buffers = null;
        }));
      });
    }
    exports.bufferCount = bufferCount;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/bufferTime.js
var require_bufferTime = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/bufferTime.js"(exports) {
    "use strict";
    var __values = exports && exports.__values || function(o2) {
      var s2 = typeof Symbol === "function" && Symbol.iterator, m2 = s2 && o2[s2], i = 0;
      if (m2) return m2.call(o2);
      if (o2 && typeof o2.length === "number") return {
        next: function() {
          if (o2 && i >= o2.length) o2 = void 0;
          return { value: o2 && o2[i++], done: !o2 };
        }
      };
      throw new TypeError(s2 ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.bufferTime = void 0;
    var Subscription_1 = require_Subscription();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var arrRemove_1 = require_arrRemove();
    var async_1 = require_async();
    var args_1 = require_args();
    var executeSchedule_1 = require_executeSchedule();
    function bufferTime(bufferTimeSpan) {
      var _a, _b;
      var otherArgs = [];
      for (var _i = 1; _i < arguments.length; _i++) {
        otherArgs[_i - 1] = arguments[_i];
      }
      var scheduler = (_a = args_1.popScheduler(otherArgs)) !== null && _a !== void 0 ? _a : async_1.asyncScheduler;
      var bufferCreationInterval = (_b = otherArgs[0]) !== null && _b !== void 0 ? _b : null;
      var maxBufferSize = otherArgs[1] || Infinity;
      return lift_1.operate(function(source, subscriber) {
        var bufferRecords = [];
        var restartOnEmit = false;
        var emit = function(record) {
          var buffer = record.buffer, subs = record.subs;
          subs.unsubscribe();
          arrRemove_1.arrRemove(bufferRecords, record);
          subscriber.next(buffer);
          restartOnEmit && startBuffer();
        };
        var startBuffer = function() {
          if (bufferRecords) {
            var subs = new Subscription_1.Subscription();
            subscriber.add(subs);
            var buffer = [];
            var record_1 = {
              buffer,
              subs
            };
            bufferRecords.push(record_1);
            executeSchedule_1.executeSchedule(subs, scheduler, function() {
              return emit(record_1);
            }, bufferTimeSpan);
          }
        };
        if (bufferCreationInterval !== null && bufferCreationInterval >= 0) {
          executeSchedule_1.executeSchedule(subscriber, scheduler, startBuffer, bufferCreationInterval, true);
        } else {
          restartOnEmit = true;
        }
        startBuffer();
        var bufferTimeSubscriber = OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          var e_1, _a2;
          var recordsCopy = bufferRecords.slice();
          try {
            for (var recordsCopy_1 = __values(recordsCopy), recordsCopy_1_1 = recordsCopy_1.next(); !recordsCopy_1_1.done; recordsCopy_1_1 = recordsCopy_1.next()) {
              var record = recordsCopy_1_1.value;
              var buffer = record.buffer;
              buffer.push(value);
              maxBufferSize <= buffer.length && emit(record);
            }
          } catch (e_1_1) {
            e_1 = { error: e_1_1 };
          } finally {
            try {
              if (recordsCopy_1_1 && !recordsCopy_1_1.done && (_a2 = recordsCopy_1.return)) _a2.call(recordsCopy_1);
            } finally {
              if (e_1) throw e_1.error;
            }
          }
        }, function() {
          while (bufferRecords === null || bufferRecords === void 0 ? void 0 : bufferRecords.length) {
            subscriber.next(bufferRecords.shift().buffer);
          }
          bufferTimeSubscriber === null || bufferTimeSubscriber === void 0 ? void 0 : bufferTimeSubscriber.unsubscribe();
          subscriber.complete();
          subscriber.unsubscribe();
        }, void 0, function() {
          return bufferRecords = null;
        });
        source.subscribe(bufferTimeSubscriber);
      });
    }
    exports.bufferTime = bufferTime;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/bufferToggle.js
var require_bufferToggle = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/bufferToggle.js"(exports) {
    "use strict";
    var __values = exports && exports.__values || function(o2) {
      var s2 = typeof Symbol === "function" && Symbol.iterator, m2 = s2 && o2[s2], i = 0;
      if (m2) return m2.call(o2);
      if (o2 && typeof o2.length === "number") return {
        next: function() {
          if (o2 && i >= o2.length) o2 = void 0;
          return { value: o2 && o2[i++], done: !o2 };
        }
      };
      throw new TypeError(s2 ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.bufferToggle = void 0;
    var Subscription_1 = require_Subscription();
    var lift_1 = require_lift();
    var innerFrom_1 = require_innerFrom();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var noop_1 = require_noop();
    var arrRemove_1 = require_arrRemove();
    function bufferToggle(openings, closingSelector) {
      return lift_1.operate(function(source, subscriber) {
        var buffers = [];
        innerFrom_1.innerFrom(openings).subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(openValue) {
          var buffer = [];
          buffers.push(buffer);
          var closingSubscription = new Subscription_1.Subscription();
          var emitBuffer = function() {
            arrRemove_1.arrRemove(buffers, buffer);
            subscriber.next(buffer);
            closingSubscription.unsubscribe();
          };
          closingSubscription.add(innerFrom_1.innerFrom(closingSelector(openValue)).subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, emitBuffer, noop_1.noop)));
        }, noop_1.noop));
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          var e_1, _a;
          try {
            for (var buffers_1 = __values(buffers), buffers_1_1 = buffers_1.next(); !buffers_1_1.done; buffers_1_1 = buffers_1.next()) {
              var buffer = buffers_1_1.value;
              buffer.push(value);
            }
          } catch (e_1_1) {
            e_1 = { error: e_1_1 };
          } finally {
            try {
              if (buffers_1_1 && !buffers_1_1.done && (_a = buffers_1.return)) _a.call(buffers_1);
            } finally {
              if (e_1) throw e_1.error;
            }
          }
        }, function() {
          while (buffers.length > 0) {
            subscriber.next(buffers.shift());
          }
          subscriber.complete();
        }));
      });
    }
    exports.bufferToggle = bufferToggle;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/bufferWhen.js
var require_bufferWhen = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/bufferWhen.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.bufferWhen = void 0;
    var lift_1 = require_lift();
    var noop_1 = require_noop();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var innerFrom_1 = require_innerFrom();
    function bufferWhen(closingSelector) {
      return lift_1.operate(function(source, subscriber) {
        var buffer = null;
        var closingSubscriber = null;
        var openBuffer = function() {
          closingSubscriber === null || closingSubscriber === void 0 ? void 0 : closingSubscriber.unsubscribe();
          var b2 = buffer;
          buffer = [];
          b2 && subscriber.next(b2);
          innerFrom_1.innerFrom(closingSelector()).subscribe(closingSubscriber = OperatorSubscriber_1.createOperatorSubscriber(subscriber, openBuffer, noop_1.noop));
        };
        openBuffer();
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          return buffer === null || buffer === void 0 ? void 0 : buffer.push(value);
        }, function() {
          buffer && subscriber.next(buffer);
          subscriber.complete();
        }, void 0, function() {
          return buffer = closingSubscriber = null;
        }));
      });
    }
    exports.bufferWhen = bufferWhen;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/catchError.js
var require_catchError = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/catchError.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.catchError = void 0;
    var innerFrom_1 = require_innerFrom();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var lift_1 = require_lift();
    function catchError(selector) {
      return lift_1.operate(function(source, subscriber) {
        var innerSub = null;
        var syncUnsub = false;
        var handledResult;
        innerSub = source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, void 0, void 0, function(err) {
          handledResult = innerFrom_1.innerFrom(selector(err, catchError(selector)(source)));
          if (innerSub) {
            innerSub.unsubscribe();
            innerSub = null;
            handledResult.subscribe(subscriber);
          } else {
            syncUnsub = true;
          }
        }));
        if (syncUnsub) {
          innerSub.unsubscribe();
          innerSub = null;
          handledResult.subscribe(subscriber);
        }
      });
    }
    exports.catchError = catchError;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/scanInternals.js
var require_scanInternals = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/scanInternals.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.scanInternals = void 0;
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function scanInternals(accumulator, seed, hasSeed, emitOnNext, emitBeforeComplete) {
      return function(source, subscriber) {
        var hasState = hasSeed;
        var state = seed;
        var index = 0;
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          var i = index++;
          state = hasState ? accumulator(state, value, i) : (hasState = true, value);
          emitOnNext && subscriber.next(state);
        }, emitBeforeComplete && (function() {
          hasState && subscriber.next(state);
          subscriber.complete();
        })));
      };
    }
    exports.scanInternals = scanInternals;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/reduce.js
var require_reduce = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/reduce.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.reduce = void 0;
    var scanInternals_1 = require_scanInternals();
    var lift_1 = require_lift();
    function reduce(accumulator, seed) {
      return lift_1.operate(scanInternals_1.scanInternals(accumulator, seed, arguments.length >= 2, false, true));
    }
    exports.reduce = reduce;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/toArray.js
var require_toArray = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/toArray.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.toArray = void 0;
    var reduce_1 = require_reduce();
    var lift_1 = require_lift();
    var arrReducer = function(arr, value) {
      return arr.push(value), arr;
    };
    function toArray() {
      return lift_1.operate(function(source, subscriber) {
        reduce_1.reduce(arrReducer, [])(source).subscribe(subscriber);
      });
    }
    exports.toArray = toArray;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/joinAllInternals.js
var require_joinAllInternals = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/joinAllInternals.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.joinAllInternals = void 0;
    var identity_1 = require_identity();
    var mapOneOrManyArgs_1 = require_mapOneOrManyArgs();
    var pipe_1 = require_pipe();
    var mergeMap_1 = require_mergeMap();
    var toArray_1 = require_toArray();
    function joinAllInternals(joinFn, project) {
      return pipe_1.pipe(toArray_1.toArray(), mergeMap_1.mergeMap(function(sources) {
        return joinFn(sources);
      }), project ? mapOneOrManyArgs_1.mapOneOrManyArgs(project) : identity_1.identity);
    }
    exports.joinAllInternals = joinAllInternals;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/combineLatestAll.js
var require_combineLatestAll = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/combineLatestAll.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.combineLatestAll = void 0;
    var combineLatest_1 = require_combineLatest();
    var joinAllInternals_1 = require_joinAllInternals();
    function combineLatestAll(project) {
      return joinAllInternals_1.joinAllInternals(combineLatest_1.combineLatest, project);
    }
    exports.combineLatestAll = combineLatestAll;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/combineAll.js
var require_combineAll = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/combineAll.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.combineAll = void 0;
    var combineLatestAll_1 = require_combineLatestAll();
    exports.combineAll = combineLatestAll_1.combineLatestAll;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/combineLatest.js
var require_combineLatest2 = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/combineLatest.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.combineLatest = void 0;
    var combineLatest_1 = require_combineLatest();
    var lift_1 = require_lift();
    var argsOrArgArray_1 = require_argsOrArgArray();
    var mapOneOrManyArgs_1 = require_mapOneOrManyArgs();
    var pipe_1 = require_pipe();
    var args_1 = require_args();
    function combineLatest() {
      var args = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
      }
      var resultSelector = args_1.popResultSelector(args);
      return resultSelector ? pipe_1.pipe(combineLatest.apply(void 0, __spreadArray([], __read(args))), mapOneOrManyArgs_1.mapOneOrManyArgs(resultSelector)) : lift_1.operate(function(source, subscriber) {
        combineLatest_1.combineLatestInit(__spreadArray([source], __read(argsOrArgArray_1.argsOrArgArray(args))))(subscriber);
      });
    }
    exports.combineLatest = combineLatest;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/combineLatestWith.js
var require_combineLatestWith = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/combineLatestWith.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.combineLatestWith = void 0;
    var combineLatest_1 = require_combineLatest2();
    function combineLatestWith() {
      var otherSources = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        otherSources[_i] = arguments[_i];
      }
      return combineLatest_1.combineLatest.apply(void 0, __spreadArray([], __read(otherSources)));
    }
    exports.combineLatestWith = combineLatestWith;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/concatMap.js
var require_concatMap = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/concatMap.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.concatMap = void 0;
    var mergeMap_1 = require_mergeMap();
    var isFunction_1 = require_isFunction();
    function concatMap(project, resultSelector) {
      return isFunction_1.isFunction(resultSelector) ? mergeMap_1.mergeMap(project, resultSelector, 1) : mergeMap_1.mergeMap(project, 1);
    }
    exports.concatMap = concatMap;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/concatMapTo.js
var require_concatMapTo = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/concatMapTo.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.concatMapTo = void 0;
    var concatMap_1 = require_concatMap();
    var isFunction_1 = require_isFunction();
    function concatMapTo(innerObservable, resultSelector) {
      return isFunction_1.isFunction(resultSelector) ? concatMap_1.concatMap(function() {
        return innerObservable;
      }, resultSelector) : concatMap_1.concatMap(function() {
        return innerObservable;
      });
    }
    exports.concatMapTo = concatMapTo;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/concat.js
var require_concat2 = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/concat.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.concat = void 0;
    var lift_1 = require_lift();
    var concatAll_1 = require_concatAll();
    var args_1 = require_args();
    var from_1 = require_from();
    function concat() {
      var args = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
      }
      var scheduler = args_1.popScheduler(args);
      return lift_1.operate(function(source, subscriber) {
        concatAll_1.concatAll()(from_1.from(__spreadArray([source], __read(args)), scheduler)).subscribe(subscriber);
      });
    }
    exports.concat = concat;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/concatWith.js
var require_concatWith = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/concatWith.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.concatWith = void 0;
    var concat_1 = require_concat2();
    function concatWith() {
      var otherSources = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        otherSources[_i] = arguments[_i];
      }
      return concat_1.concat.apply(void 0, __spreadArray([], __read(otherSources)));
    }
    exports.concatWith = concatWith;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/fromSubscribable.js
var require_fromSubscribable = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/observable/fromSubscribable.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.fromSubscribable = void 0;
    var Observable_1 = require_Observable();
    function fromSubscribable(subscribable) {
      return new Observable_1.Observable(function(subscriber) {
        return subscribable.subscribe(subscriber);
      });
    }
    exports.fromSubscribable = fromSubscribable;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/connect.js
var require_connect = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/connect.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.connect = void 0;
    var Subject_1 = require_Subject();
    var innerFrom_1 = require_innerFrom();
    var lift_1 = require_lift();
    var fromSubscribable_1 = require_fromSubscribable();
    var DEFAULT_CONFIG = {
      connector: function() {
        return new Subject_1.Subject();
      }
    };
    function connect(selector, config) {
      if (config === void 0) {
        config = DEFAULT_CONFIG;
      }
      var connector = config.connector;
      return lift_1.operate(function(source, subscriber) {
        var subject = connector();
        innerFrom_1.innerFrom(selector(fromSubscribable_1.fromSubscribable(subject))).subscribe(subscriber);
        subscriber.add(source.subscribe(subject));
      });
    }
    exports.connect = connect;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/count.js
var require_count = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/count.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.count = void 0;
    var reduce_1 = require_reduce();
    function count(predicate) {
      return reduce_1.reduce(function(total, value, i) {
        return !predicate || predicate(value, i) ? total + 1 : total;
      }, 0);
    }
    exports.count = count;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/debounce.js
var require_debounce = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/debounce.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.debounce = void 0;
    var lift_1 = require_lift();
    var noop_1 = require_noop();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var innerFrom_1 = require_innerFrom();
    function debounce(durationSelector) {
      return lift_1.operate(function(source, subscriber) {
        var hasValue = false;
        var lastValue = null;
        var durationSubscriber = null;
        var emit = function() {
          durationSubscriber === null || durationSubscriber === void 0 ? void 0 : durationSubscriber.unsubscribe();
          durationSubscriber = null;
          if (hasValue) {
            hasValue = false;
            var value = lastValue;
            lastValue = null;
            subscriber.next(value);
          }
        };
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          durationSubscriber === null || durationSubscriber === void 0 ? void 0 : durationSubscriber.unsubscribe();
          hasValue = true;
          lastValue = value;
          durationSubscriber = OperatorSubscriber_1.createOperatorSubscriber(subscriber, emit, noop_1.noop);
          innerFrom_1.innerFrom(durationSelector(value)).subscribe(durationSubscriber);
        }, function() {
          emit();
          subscriber.complete();
        }, void 0, function() {
          lastValue = durationSubscriber = null;
        }));
      });
    }
    exports.debounce = debounce;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/debounceTime.js
var require_debounceTime = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/debounceTime.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.debounceTime = void 0;
    var async_1 = require_async();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function debounceTime(dueTime, scheduler) {
      if (scheduler === void 0) {
        scheduler = async_1.asyncScheduler;
      }
      return lift_1.operate(function(source, subscriber) {
        var activeTask = null;
        var lastValue = null;
        var lastTime = null;
        var emit = function() {
          if (activeTask) {
            activeTask.unsubscribe();
            activeTask = null;
            var value = lastValue;
            lastValue = null;
            subscriber.next(value);
          }
        };
        function emitWhenIdle() {
          var targetTime = lastTime + dueTime;
          var now = scheduler.now();
          if (now < targetTime) {
            activeTask = this.schedule(void 0, targetTime - now);
            subscriber.add(activeTask);
            return;
          }
          emit();
        }
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          lastValue = value;
          lastTime = scheduler.now();
          if (!activeTask) {
            activeTask = scheduler.schedule(emitWhenIdle, dueTime);
            subscriber.add(activeTask);
          }
        }, function() {
          emit();
          subscriber.complete();
        }, void 0, function() {
          lastValue = activeTask = null;
        }));
      });
    }
    exports.debounceTime = debounceTime;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/defaultIfEmpty.js
var require_defaultIfEmpty = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/defaultIfEmpty.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.defaultIfEmpty = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function defaultIfEmpty(defaultValue) {
      return lift_1.operate(function(source, subscriber) {
        var hasValue = false;
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          hasValue = true;
          subscriber.next(value);
        }, function() {
          if (!hasValue) {
            subscriber.next(defaultValue);
          }
          subscriber.complete();
        }));
      });
    }
    exports.defaultIfEmpty = defaultIfEmpty;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/take.js
var require_take = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/take.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.take = void 0;
    var empty_1 = require_empty();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function take(count) {
      return count <= 0 ? function() {
        return empty_1.EMPTY;
      } : lift_1.operate(function(source, subscriber) {
        var seen = 0;
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          if (++seen <= count) {
            subscriber.next(value);
            if (count <= seen) {
              subscriber.complete();
            }
          }
        }));
      });
    }
    exports.take = take;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/ignoreElements.js
var require_ignoreElements = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/ignoreElements.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ignoreElements = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var noop_1 = require_noop();
    function ignoreElements() {
      return lift_1.operate(function(source, subscriber) {
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, noop_1.noop));
      });
    }
    exports.ignoreElements = ignoreElements;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/mapTo.js
var require_mapTo = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/mapTo.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.mapTo = void 0;
    var map_1 = require_map();
    function mapTo(value) {
      return map_1.map(function() {
        return value;
      });
    }
    exports.mapTo = mapTo;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/delayWhen.js
var require_delayWhen = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/delayWhen.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.delayWhen = void 0;
    var concat_1 = require_concat();
    var take_1 = require_take();
    var ignoreElements_1 = require_ignoreElements();
    var mapTo_1 = require_mapTo();
    var mergeMap_1 = require_mergeMap();
    var innerFrom_1 = require_innerFrom();
    function delayWhen(delayDurationSelector, subscriptionDelay) {
      if (subscriptionDelay) {
        return function(source) {
          return concat_1.concat(subscriptionDelay.pipe(take_1.take(1), ignoreElements_1.ignoreElements()), source.pipe(delayWhen(delayDurationSelector)));
        };
      }
      return mergeMap_1.mergeMap(function(value, index) {
        return innerFrom_1.innerFrom(delayDurationSelector(value, index)).pipe(take_1.take(1), mapTo_1.mapTo(value));
      });
    }
    exports.delayWhen = delayWhen;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/delay.js
var require_delay = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/delay.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.delay = void 0;
    var async_1 = require_async();
    var delayWhen_1 = require_delayWhen();
    var timer_1 = require_timer();
    function delay(due, scheduler) {
      if (scheduler === void 0) {
        scheduler = async_1.asyncScheduler;
      }
      var duration = timer_1.timer(due, scheduler);
      return delayWhen_1.delayWhen(function() {
        return duration;
      });
    }
    exports.delay = delay;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/dematerialize.js
var require_dematerialize = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/dematerialize.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dematerialize = void 0;
    var Notification_1 = require_Notification();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function dematerialize() {
      return lift_1.operate(function(source, subscriber) {
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(notification) {
          return Notification_1.observeNotification(notification, subscriber);
        }));
      });
    }
    exports.dematerialize = dematerialize;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/distinct.js
var require_distinct = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/distinct.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.distinct = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var noop_1 = require_noop();
    var innerFrom_1 = require_innerFrom();
    function distinct(keySelector, flushes) {
      return lift_1.operate(function(source, subscriber) {
        var distinctKeys = /* @__PURE__ */ new Set();
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          var key = keySelector ? keySelector(value) : value;
          if (!distinctKeys.has(key)) {
            distinctKeys.add(key);
            subscriber.next(value);
          }
        }));
        flushes && innerFrom_1.innerFrom(flushes).subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function() {
          return distinctKeys.clear();
        }, noop_1.noop));
      });
    }
    exports.distinct = distinct;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/distinctUntilChanged.js
var require_distinctUntilChanged = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/distinctUntilChanged.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.distinctUntilChanged = void 0;
    var identity_1 = require_identity();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function distinctUntilChanged(comparator, keySelector) {
      if (keySelector === void 0) {
        keySelector = identity_1.identity;
      }
      comparator = comparator !== null && comparator !== void 0 ? comparator : defaultCompare;
      return lift_1.operate(function(source, subscriber) {
        var previousKey;
        var first = true;
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          var currentKey = keySelector(value);
          if (first || !comparator(previousKey, currentKey)) {
            first = false;
            previousKey = currentKey;
            subscriber.next(value);
          }
        }));
      });
    }
    exports.distinctUntilChanged = distinctUntilChanged;
    function defaultCompare(a2, b2) {
      return a2 === b2;
    }
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/distinctUntilKeyChanged.js
var require_distinctUntilKeyChanged = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/distinctUntilKeyChanged.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.distinctUntilKeyChanged = void 0;
    var distinctUntilChanged_1 = require_distinctUntilChanged();
    function distinctUntilKeyChanged(key, compare) {
      return distinctUntilChanged_1.distinctUntilChanged(function(x2, y2) {
        return compare ? compare(x2[key], y2[key]) : x2[key] === y2[key];
      });
    }
    exports.distinctUntilKeyChanged = distinctUntilKeyChanged;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/throwIfEmpty.js
var require_throwIfEmpty = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/throwIfEmpty.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.throwIfEmpty = void 0;
    var EmptyError_1 = require_EmptyError();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function throwIfEmpty(errorFactory) {
      if (errorFactory === void 0) {
        errorFactory = defaultErrorFactory;
      }
      return lift_1.operate(function(source, subscriber) {
        var hasValue = false;
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          hasValue = true;
          subscriber.next(value);
        }, function() {
          return hasValue ? subscriber.complete() : subscriber.error(errorFactory());
        }));
      });
    }
    exports.throwIfEmpty = throwIfEmpty;
    function defaultErrorFactory() {
      return new EmptyError_1.EmptyError();
    }
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/elementAt.js
var require_elementAt = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/elementAt.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.elementAt = void 0;
    var ArgumentOutOfRangeError_1 = require_ArgumentOutOfRangeError();
    var filter_1 = require_filter();
    var throwIfEmpty_1 = require_throwIfEmpty();
    var defaultIfEmpty_1 = require_defaultIfEmpty();
    var take_1 = require_take();
    function elementAt(index, defaultValue) {
      if (index < 0) {
        throw new ArgumentOutOfRangeError_1.ArgumentOutOfRangeError();
      }
      var hasDefaultValue = arguments.length >= 2;
      return function(source) {
        return source.pipe(filter_1.filter(function(v2, i) {
          return i === index;
        }), take_1.take(1), hasDefaultValue ? defaultIfEmpty_1.defaultIfEmpty(defaultValue) : throwIfEmpty_1.throwIfEmpty(function() {
          return new ArgumentOutOfRangeError_1.ArgumentOutOfRangeError();
        }));
      };
    }
    exports.elementAt = elementAt;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/endWith.js
var require_endWith = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/endWith.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.endWith = void 0;
    var concat_1 = require_concat();
    var of_1 = require_of();
    function endWith() {
      var values = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        values[_i] = arguments[_i];
      }
      return function(source) {
        return concat_1.concat(source, of_1.of.apply(void 0, __spreadArray([], __read(values))));
      };
    }
    exports.endWith = endWith;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/every.js
var require_every = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/every.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.every = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function every(predicate, thisArg) {
      return lift_1.operate(function(source, subscriber) {
        var index = 0;
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          if (!predicate.call(thisArg, value, index++, source)) {
            subscriber.next(false);
            subscriber.complete();
          }
        }, function() {
          subscriber.next(true);
          subscriber.complete();
        }));
      });
    }
    exports.every = every;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/exhaustMap.js
var require_exhaustMap = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/exhaustMap.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.exhaustMap = void 0;
    var map_1 = require_map();
    var innerFrom_1 = require_innerFrom();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function exhaustMap(project, resultSelector) {
      if (resultSelector) {
        return function(source) {
          return source.pipe(exhaustMap(function(a2, i) {
            return innerFrom_1.innerFrom(project(a2, i)).pipe(map_1.map(function(b2, ii) {
              return resultSelector(a2, b2, i, ii);
            }));
          }));
        };
      }
      return lift_1.operate(function(source, subscriber) {
        var index = 0;
        var innerSub = null;
        var isComplete = false;
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(outerValue) {
          if (!innerSub) {
            innerSub = OperatorSubscriber_1.createOperatorSubscriber(subscriber, void 0, function() {
              innerSub = null;
              isComplete && subscriber.complete();
            });
            innerFrom_1.innerFrom(project(outerValue, index++)).subscribe(innerSub);
          }
        }, function() {
          isComplete = true;
          !innerSub && subscriber.complete();
        }));
      });
    }
    exports.exhaustMap = exhaustMap;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/exhaustAll.js
var require_exhaustAll = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/exhaustAll.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.exhaustAll = void 0;
    var exhaustMap_1 = require_exhaustMap();
    var identity_1 = require_identity();
    function exhaustAll() {
      return exhaustMap_1.exhaustMap(identity_1.identity);
    }
    exports.exhaustAll = exhaustAll;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/exhaust.js
var require_exhaust = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/exhaust.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.exhaust = void 0;
    var exhaustAll_1 = require_exhaustAll();
    exports.exhaust = exhaustAll_1.exhaustAll;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/expand.js
var require_expand = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/expand.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.expand = void 0;
    var lift_1 = require_lift();
    var mergeInternals_1 = require_mergeInternals();
    function expand(project, concurrent, scheduler) {
      if (concurrent === void 0) {
        concurrent = Infinity;
      }
      concurrent = (concurrent || 0) < 1 ? Infinity : concurrent;
      return lift_1.operate(function(source, subscriber) {
        return mergeInternals_1.mergeInternals(source, subscriber, project, concurrent, void 0, true, scheduler);
      });
    }
    exports.expand = expand;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/finalize.js
var require_finalize = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/finalize.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.finalize = void 0;
    var lift_1 = require_lift();
    function finalize(callback) {
      return lift_1.operate(function(source, subscriber) {
        try {
          source.subscribe(subscriber);
        } finally {
          subscriber.add(callback);
        }
      });
    }
    exports.finalize = finalize;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/find.js
var require_find = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/find.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createFind = exports.find = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function find(predicate, thisArg) {
      return lift_1.operate(createFind(predicate, thisArg, "value"));
    }
    exports.find = find;
    function createFind(predicate, thisArg, emit) {
      var findIndex = emit === "index";
      return function(source, subscriber) {
        var index = 0;
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          var i = index++;
          if (predicate.call(thisArg, value, i, source)) {
            subscriber.next(findIndex ? i : value);
            subscriber.complete();
          }
        }, function() {
          subscriber.next(findIndex ? -1 : void 0);
          subscriber.complete();
        }));
      };
    }
    exports.createFind = createFind;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/findIndex.js
var require_findIndex = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/findIndex.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.findIndex = void 0;
    var lift_1 = require_lift();
    var find_1 = require_find();
    function findIndex(predicate, thisArg) {
      return lift_1.operate(find_1.createFind(predicate, thisArg, "index"));
    }
    exports.findIndex = findIndex;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/first.js
var require_first = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/first.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.first = void 0;
    var EmptyError_1 = require_EmptyError();
    var filter_1 = require_filter();
    var take_1 = require_take();
    var defaultIfEmpty_1 = require_defaultIfEmpty();
    var throwIfEmpty_1 = require_throwIfEmpty();
    var identity_1 = require_identity();
    function first(predicate, defaultValue) {
      var hasDefaultValue = arguments.length >= 2;
      return function(source) {
        return source.pipe(predicate ? filter_1.filter(function(v2, i) {
          return predicate(v2, i, source);
        }) : identity_1.identity, take_1.take(1), hasDefaultValue ? defaultIfEmpty_1.defaultIfEmpty(defaultValue) : throwIfEmpty_1.throwIfEmpty(function() {
          return new EmptyError_1.EmptyError();
        }));
      };
    }
    exports.first = first;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/groupBy.js
var require_groupBy = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/groupBy.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.groupBy = void 0;
    var Observable_1 = require_Observable();
    var innerFrom_1 = require_innerFrom();
    var Subject_1 = require_Subject();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function groupBy(keySelector, elementOrOptions, duration, connector) {
      return lift_1.operate(function(source, subscriber) {
        var element;
        if (!elementOrOptions || typeof elementOrOptions === "function") {
          element = elementOrOptions;
        } else {
          duration = elementOrOptions.duration, element = elementOrOptions.element, connector = elementOrOptions.connector;
        }
        var groups = /* @__PURE__ */ new Map();
        var notify = function(cb) {
          groups.forEach(cb);
          cb(subscriber);
        };
        var handleError = function(err) {
          return notify(function(consumer) {
            return consumer.error(err);
          });
        };
        var activeGroups = 0;
        var teardownAttempted = false;
        var groupBySourceSubscriber = new OperatorSubscriber_1.OperatorSubscriber(subscriber, function(value) {
          try {
            var key_1 = keySelector(value);
            var group_1 = groups.get(key_1);
            if (!group_1) {
              groups.set(key_1, group_1 = connector ? connector() : new Subject_1.Subject());
              var grouped = createGroupedObservable(key_1, group_1);
              subscriber.next(grouped);
              if (duration) {
                var durationSubscriber_1 = OperatorSubscriber_1.createOperatorSubscriber(group_1, function() {
                  group_1.complete();
                  durationSubscriber_1 === null || durationSubscriber_1 === void 0 ? void 0 : durationSubscriber_1.unsubscribe();
                }, void 0, void 0, function() {
                  return groups.delete(key_1);
                });
                groupBySourceSubscriber.add(innerFrom_1.innerFrom(duration(grouped)).subscribe(durationSubscriber_1));
              }
            }
            group_1.next(element ? element(value) : value);
          } catch (err) {
            handleError(err);
          }
        }, function() {
          return notify(function(consumer) {
            return consumer.complete();
          });
        }, handleError, function() {
          return groups.clear();
        }, function() {
          teardownAttempted = true;
          return activeGroups === 0;
        });
        source.subscribe(groupBySourceSubscriber);
        function createGroupedObservable(key, groupSubject) {
          var result = new Observable_1.Observable(function(groupSubscriber) {
            activeGroups++;
            var innerSub = groupSubject.subscribe(groupSubscriber);
            return function() {
              innerSub.unsubscribe();
              --activeGroups === 0 && teardownAttempted && groupBySourceSubscriber.unsubscribe();
            };
          });
          result.key = key;
          return result;
        }
      });
    }
    exports.groupBy = groupBy;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/isEmpty.js
var require_isEmpty = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/isEmpty.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isEmpty = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function isEmpty() {
      return lift_1.operate(function(source, subscriber) {
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function() {
          subscriber.next(false);
          subscriber.complete();
        }, function() {
          subscriber.next(true);
          subscriber.complete();
        }));
      });
    }
    exports.isEmpty = isEmpty;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/takeLast.js
var require_takeLast = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/takeLast.js"(exports) {
    "use strict";
    var __values = exports && exports.__values || function(o2) {
      var s2 = typeof Symbol === "function" && Symbol.iterator, m2 = s2 && o2[s2], i = 0;
      if (m2) return m2.call(o2);
      if (o2 && typeof o2.length === "number") return {
        next: function() {
          if (o2 && i >= o2.length) o2 = void 0;
          return { value: o2 && o2[i++], done: !o2 };
        }
      };
      throw new TypeError(s2 ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.takeLast = void 0;
    var empty_1 = require_empty();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function takeLast(count) {
      return count <= 0 ? function() {
        return empty_1.EMPTY;
      } : lift_1.operate(function(source, subscriber) {
        var buffer = [];
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          buffer.push(value);
          count < buffer.length && buffer.shift();
        }, function() {
          var e_1, _a;
          try {
            for (var buffer_1 = __values(buffer), buffer_1_1 = buffer_1.next(); !buffer_1_1.done; buffer_1_1 = buffer_1.next()) {
              var value = buffer_1_1.value;
              subscriber.next(value);
            }
          } catch (e_1_1) {
            e_1 = { error: e_1_1 };
          } finally {
            try {
              if (buffer_1_1 && !buffer_1_1.done && (_a = buffer_1.return)) _a.call(buffer_1);
            } finally {
              if (e_1) throw e_1.error;
            }
          }
          subscriber.complete();
        }, void 0, function() {
          buffer = null;
        }));
      });
    }
    exports.takeLast = takeLast;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/last.js
var require_last = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/last.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.last = void 0;
    var EmptyError_1 = require_EmptyError();
    var filter_1 = require_filter();
    var takeLast_1 = require_takeLast();
    var throwIfEmpty_1 = require_throwIfEmpty();
    var defaultIfEmpty_1 = require_defaultIfEmpty();
    var identity_1 = require_identity();
    function last(predicate, defaultValue) {
      var hasDefaultValue = arguments.length >= 2;
      return function(source) {
        return source.pipe(predicate ? filter_1.filter(function(v2, i) {
          return predicate(v2, i, source);
        }) : identity_1.identity, takeLast_1.takeLast(1), hasDefaultValue ? defaultIfEmpty_1.defaultIfEmpty(defaultValue) : throwIfEmpty_1.throwIfEmpty(function() {
          return new EmptyError_1.EmptyError();
        }));
      };
    }
    exports.last = last;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/materialize.js
var require_materialize = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/materialize.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.materialize = void 0;
    var Notification_1 = require_Notification();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function materialize() {
      return lift_1.operate(function(source, subscriber) {
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          subscriber.next(Notification_1.Notification.createNext(value));
        }, function() {
          subscriber.next(Notification_1.Notification.createComplete());
          subscriber.complete();
        }, function(err) {
          subscriber.next(Notification_1.Notification.createError(err));
          subscriber.complete();
        }));
      });
    }
    exports.materialize = materialize;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/max.js
var require_max = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/max.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.max = void 0;
    var reduce_1 = require_reduce();
    var isFunction_1 = require_isFunction();
    function max(comparer) {
      return reduce_1.reduce(isFunction_1.isFunction(comparer) ? function(x2, y2) {
        return comparer(x2, y2) > 0 ? x2 : y2;
      } : function(x2, y2) {
        return x2 > y2 ? x2 : y2;
      });
    }
    exports.max = max;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/flatMap.js
var require_flatMap = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/flatMap.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.flatMap = void 0;
    var mergeMap_1 = require_mergeMap();
    exports.flatMap = mergeMap_1.mergeMap;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/mergeMapTo.js
var require_mergeMapTo = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/mergeMapTo.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.mergeMapTo = void 0;
    var mergeMap_1 = require_mergeMap();
    var isFunction_1 = require_isFunction();
    function mergeMapTo(innerObservable, resultSelector, concurrent) {
      if (concurrent === void 0) {
        concurrent = Infinity;
      }
      if (isFunction_1.isFunction(resultSelector)) {
        return mergeMap_1.mergeMap(function() {
          return innerObservable;
        }, resultSelector, concurrent);
      }
      if (typeof resultSelector === "number") {
        concurrent = resultSelector;
      }
      return mergeMap_1.mergeMap(function() {
        return innerObservable;
      }, concurrent);
    }
    exports.mergeMapTo = mergeMapTo;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/mergeScan.js
var require_mergeScan = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/mergeScan.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.mergeScan = void 0;
    var lift_1 = require_lift();
    var mergeInternals_1 = require_mergeInternals();
    function mergeScan(accumulator, seed, concurrent) {
      if (concurrent === void 0) {
        concurrent = Infinity;
      }
      return lift_1.operate(function(source, subscriber) {
        var state = seed;
        return mergeInternals_1.mergeInternals(source, subscriber, function(value, index) {
          return accumulator(state, value, index);
        }, concurrent, function(value) {
          state = value;
        }, false, void 0, function() {
          return state = null;
        });
      });
    }
    exports.mergeScan = mergeScan;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/merge.js
var require_merge2 = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/merge.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.merge = void 0;
    var lift_1 = require_lift();
    var argsOrArgArray_1 = require_argsOrArgArray();
    var mergeAll_1 = require_mergeAll();
    var args_1 = require_args();
    var from_1 = require_from();
    function merge() {
      var args = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
      }
      var scheduler = args_1.popScheduler(args);
      var concurrent = args_1.popNumber(args, Infinity);
      args = argsOrArgArray_1.argsOrArgArray(args);
      return lift_1.operate(function(source, subscriber) {
        mergeAll_1.mergeAll(concurrent)(from_1.from(__spreadArray([source], __read(args)), scheduler)).subscribe(subscriber);
      });
    }
    exports.merge = merge;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/mergeWith.js
var require_mergeWith = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/mergeWith.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.mergeWith = void 0;
    var merge_1 = require_merge2();
    function mergeWith() {
      var otherSources = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        otherSources[_i] = arguments[_i];
      }
      return merge_1.merge.apply(void 0, __spreadArray([], __read(otherSources)));
    }
    exports.mergeWith = mergeWith;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/min.js
var require_min = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/min.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.min = void 0;
    var reduce_1 = require_reduce();
    var isFunction_1 = require_isFunction();
    function min(comparer) {
      return reduce_1.reduce(isFunction_1.isFunction(comparer) ? function(x2, y2) {
        return comparer(x2, y2) < 0 ? x2 : y2;
      } : function(x2, y2) {
        return x2 < y2 ? x2 : y2;
      });
    }
    exports.min = min;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/multicast.js
var require_multicast = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/multicast.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.multicast = void 0;
    var ConnectableObservable_1 = require_ConnectableObservable();
    var isFunction_1 = require_isFunction();
    var connect_1 = require_connect();
    function multicast(subjectOrSubjectFactory, selector) {
      var subjectFactory = isFunction_1.isFunction(subjectOrSubjectFactory) ? subjectOrSubjectFactory : function() {
        return subjectOrSubjectFactory;
      };
      if (isFunction_1.isFunction(selector)) {
        return connect_1.connect(selector, {
          connector: subjectFactory
        });
      }
      return function(source) {
        return new ConnectableObservable_1.ConnectableObservable(source, subjectFactory);
      };
    }
    exports.multicast = multicast;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/onErrorResumeNextWith.js
var require_onErrorResumeNextWith = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/onErrorResumeNextWith.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.onErrorResumeNext = exports.onErrorResumeNextWith = void 0;
    var argsOrArgArray_1 = require_argsOrArgArray();
    var onErrorResumeNext_1 = require_onErrorResumeNext();
    function onErrorResumeNextWith() {
      var sources = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        sources[_i] = arguments[_i];
      }
      var nextSources = argsOrArgArray_1.argsOrArgArray(sources);
      return function(source) {
        return onErrorResumeNext_1.onErrorResumeNext.apply(void 0, __spreadArray([source], __read(nextSources)));
      };
    }
    exports.onErrorResumeNextWith = onErrorResumeNextWith;
    exports.onErrorResumeNext = onErrorResumeNextWith;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/pairwise.js
var require_pairwise = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/pairwise.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.pairwise = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function pairwise() {
      return lift_1.operate(function(source, subscriber) {
        var prev;
        var hasPrev = false;
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          var p2 = prev;
          prev = value;
          hasPrev && subscriber.next([p2, value]);
          hasPrev = true;
        }));
      });
    }
    exports.pairwise = pairwise;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/pluck.js
var require_pluck = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/pluck.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.pluck = void 0;
    var map_1 = require_map();
    function pluck() {
      var properties = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        properties[_i] = arguments[_i];
      }
      var length = properties.length;
      if (length === 0) {
        throw new Error("list of properties cannot be empty.");
      }
      return map_1.map(function(x2) {
        var currentProp = x2;
        for (var i = 0; i < length; i++) {
          var p2 = currentProp === null || currentProp === void 0 ? void 0 : currentProp[properties[i]];
          if (typeof p2 !== "undefined") {
            currentProp = p2;
          } else {
            return void 0;
          }
        }
        return currentProp;
      });
    }
    exports.pluck = pluck;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/publish.js
var require_publish = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/publish.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.publish = void 0;
    var Subject_1 = require_Subject();
    var multicast_1 = require_multicast();
    var connect_1 = require_connect();
    function publish(selector) {
      return selector ? function(source) {
        return connect_1.connect(selector)(source);
      } : function(source) {
        return multicast_1.multicast(new Subject_1.Subject())(source);
      };
    }
    exports.publish = publish;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/publishBehavior.js
var require_publishBehavior = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/publishBehavior.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.publishBehavior = void 0;
    var BehaviorSubject_1 = require_BehaviorSubject();
    var ConnectableObservable_1 = require_ConnectableObservable();
    function publishBehavior(initialValue) {
      return function(source) {
        var subject = new BehaviorSubject_1.BehaviorSubject(initialValue);
        return new ConnectableObservable_1.ConnectableObservable(source, function() {
          return subject;
        });
      };
    }
    exports.publishBehavior = publishBehavior;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/publishLast.js
var require_publishLast = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/publishLast.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.publishLast = void 0;
    var AsyncSubject_1 = require_AsyncSubject();
    var ConnectableObservable_1 = require_ConnectableObservable();
    function publishLast() {
      return function(source) {
        var subject = new AsyncSubject_1.AsyncSubject();
        return new ConnectableObservable_1.ConnectableObservable(source, function() {
          return subject;
        });
      };
    }
    exports.publishLast = publishLast;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/publishReplay.js
var require_publishReplay = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/publishReplay.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.publishReplay = void 0;
    var ReplaySubject_1 = require_ReplaySubject();
    var multicast_1 = require_multicast();
    var isFunction_1 = require_isFunction();
    function publishReplay(bufferSize, windowTime, selectorOrScheduler, timestampProvider) {
      if (selectorOrScheduler && !isFunction_1.isFunction(selectorOrScheduler)) {
        timestampProvider = selectorOrScheduler;
      }
      var selector = isFunction_1.isFunction(selectorOrScheduler) ? selectorOrScheduler : void 0;
      return function(source) {
        return multicast_1.multicast(new ReplaySubject_1.ReplaySubject(bufferSize, windowTime, timestampProvider), selector)(source);
      };
    }
    exports.publishReplay = publishReplay;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/raceWith.js
var require_raceWith = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/raceWith.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.raceWith = void 0;
    var race_1 = require_race();
    var lift_1 = require_lift();
    var identity_1 = require_identity();
    function raceWith() {
      var otherSources = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        otherSources[_i] = arguments[_i];
      }
      return !otherSources.length ? identity_1.identity : lift_1.operate(function(source, subscriber) {
        race_1.raceInit(__spreadArray([source], __read(otherSources)))(subscriber);
      });
    }
    exports.raceWith = raceWith;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/repeat.js
var require_repeat = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/repeat.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.repeat = void 0;
    var empty_1 = require_empty();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var innerFrom_1 = require_innerFrom();
    var timer_1 = require_timer();
    function repeat(countOrConfig) {
      var _a;
      var count = Infinity;
      var delay;
      if (countOrConfig != null) {
        if (typeof countOrConfig === "object") {
          _a = countOrConfig.count, count = _a === void 0 ? Infinity : _a, delay = countOrConfig.delay;
        } else {
          count = countOrConfig;
        }
      }
      return count <= 0 ? function() {
        return empty_1.EMPTY;
      } : lift_1.operate(function(source, subscriber) {
        var soFar = 0;
        var sourceSub;
        var resubscribe = function() {
          sourceSub === null || sourceSub === void 0 ? void 0 : sourceSub.unsubscribe();
          sourceSub = null;
          if (delay != null) {
            var notifier = typeof delay === "number" ? timer_1.timer(delay) : innerFrom_1.innerFrom(delay(soFar));
            var notifierSubscriber_1 = OperatorSubscriber_1.createOperatorSubscriber(subscriber, function() {
              notifierSubscriber_1.unsubscribe();
              subscribeToSource();
            });
            notifier.subscribe(notifierSubscriber_1);
          } else {
            subscribeToSource();
          }
        };
        var subscribeToSource = function() {
          var syncUnsub = false;
          sourceSub = source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, void 0, function() {
            if (++soFar < count) {
              if (sourceSub) {
                resubscribe();
              } else {
                syncUnsub = true;
              }
            } else {
              subscriber.complete();
            }
          }));
          if (syncUnsub) {
            resubscribe();
          }
        };
        subscribeToSource();
      });
    }
    exports.repeat = repeat;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/repeatWhen.js
var require_repeatWhen = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/repeatWhen.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.repeatWhen = void 0;
    var innerFrom_1 = require_innerFrom();
    var Subject_1 = require_Subject();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function repeatWhen(notifier) {
      return lift_1.operate(function(source, subscriber) {
        var innerSub;
        var syncResub = false;
        var completions$;
        var isNotifierComplete = false;
        var isMainComplete = false;
        var checkComplete = function() {
          return isMainComplete && isNotifierComplete && (subscriber.complete(), true);
        };
        var getCompletionSubject = function() {
          if (!completions$) {
            completions$ = new Subject_1.Subject();
            innerFrom_1.innerFrom(notifier(completions$)).subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function() {
              if (innerSub) {
                subscribeForRepeatWhen();
              } else {
                syncResub = true;
              }
            }, function() {
              isNotifierComplete = true;
              checkComplete();
            }));
          }
          return completions$;
        };
        var subscribeForRepeatWhen = function() {
          isMainComplete = false;
          innerSub = source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, void 0, function() {
            isMainComplete = true;
            !checkComplete() && getCompletionSubject().next();
          }));
          if (syncResub) {
            innerSub.unsubscribe();
            innerSub = null;
            syncResub = false;
            subscribeForRepeatWhen();
          }
        };
        subscribeForRepeatWhen();
      });
    }
    exports.repeatWhen = repeatWhen;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/retry.js
var require_retry = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/retry.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.retry = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var identity_1 = require_identity();
    var timer_1 = require_timer();
    var innerFrom_1 = require_innerFrom();
    function retry(configOrCount) {
      if (configOrCount === void 0) {
        configOrCount = Infinity;
      }
      var config;
      if (configOrCount && typeof configOrCount === "object") {
        config = configOrCount;
      } else {
        config = {
          count: configOrCount
        };
      }
      var _a = config.count, count = _a === void 0 ? Infinity : _a, delay = config.delay, _b = config.resetOnSuccess, resetOnSuccess = _b === void 0 ? false : _b;
      return count <= 0 ? identity_1.identity : lift_1.operate(function(source, subscriber) {
        var soFar = 0;
        var innerSub;
        var subscribeForRetry = function() {
          var syncUnsub = false;
          innerSub = source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
            if (resetOnSuccess) {
              soFar = 0;
            }
            subscriber.next(value);
          }, void 0, function(err) {
            if (soFar++ < count) {
              var resub_1 = function() {
                if (innerSub) {
                  innerSub.unsubscribe();
                  innerSub = null;
                  subscribeForRetry();
                } else {
                  syncUnsub = true;
                }
              };
              if (delay != null) {
                var notifier = typeof delay === "number" ? timer_1.timer(delay) : innerFrom_1.innerFrom(delay(err, soFar));
                var notifierSubscriber_1 = OperatorSubscriber_1.createOperatorSubscriber(subscriber, function() {
                  notifierSubscriber_1.unsubscribe();
                  resub_1();
                }, function() {
                  subscriber.complete();
                });
                notifier.subscribe(notifierSubscriber_1);
              } else {
                resub_1();
              }
            } else {
              subscriber.error(err);
            }
          }));
          if (syncUnsub) {
            innerSub.unsubscribe();
            innerSub = null;
            subscribeForRetry();
          }
        };
        subscribeForRetry();
      });
    }
    exports.retry = retry;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/retryWhen.js
var require_retryWhen = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/retryWhen.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.retryWhen = void 0;
    var innerFrom_1 = require_innerFrom();
    var Subject_1 = require_Subject();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function retryWhen(notifier) {
      return lift_1.operate(function(source, subscriber) {
        var innerSub;
        var syncResub = false;
        var errors$;
        var subscribeForRetryWhen = function() {
          innerSub = source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, void 0, void 0, function(err) {
            if (!errors$) {
              errors$ = new Subject_1.Subject();
              innerFrom_1.innerFrom(notifier(errors$)).subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function() {
                return innerSub ? subscribeForRetryWhen() : syncResub = true;
              }));
            }
            if (errors$) {
              errors$.next(err);
            }
          }));
          if (syncResub) {
            innerSub.unsubscribe();
            innerSub = null;
            syncResub = false;
            subscribeForRetryWhen();
          }
        };
        subscribeForRetryWhen();
      });
    }
    exports.retryWhen = retryWhen;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/sample.js
var require_sample = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/sample.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sample = void 0;
    var innerFrom_1 = require_innerFrom();
    var lift_1 = require_lift();
    var noop_1 = require_noop();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function sample(notifier) {
      return lift_1.operate(function(source, subscriber) {
        var hasValue = false;
        var lastValue = null;
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          hasValue = true;
          lastValue = value;
        }));
        innerFrom_1.innerFrom(notifier).subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function() {
          if (hasValue) {
            hasValue = false;
            var value = lastValue;
            lastValue = null;
            subscriber.next(value);
          }
        }, noop_1.noop));
      });
    }
    exports.sample = sample;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/sampleTime.js
var require_sampleTime = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/sampleTime.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sampleTime = void 0;
    var async_1 = require_async();
    var sample_1 = require_sample();
    var interval_1 = require_interval();
    function sampleTime(period, scheduler) {
      if (scheduler === void 0) {
        scheduler = async_1.asyncScheduler;
      }
      return sample_1.sample(interval_1.interval(period, scheduler));
    }
    exports.sampleTime = sampleTime;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/scan.js
var require_scan = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/scan.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.scan = void 0;
    var lift_1 = require_lift();
    var scanInternals_1 = require_scanInternals();
    function scan(accumulator, seed) {
      return lift_1.operate(scanInternals_1.scanInternals(accumulator, seed, arguments.length >= 2, true));
    }
    exports.scan = scan;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/sequenceEqual.js
var require_sequenceEqual = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/sequenceEqual.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sequenceEqual = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var innerFrom_1 = require_innerFrom();
    function sequenceEqual(compareTo, comparator) {
      if (comparator === void 0) {
        comparator = function(a2, b2) {
          return a2 === b2;
        };
      }
      return lift_1.operate(function(source, subscriber) {
        var aState = createState();
        var bState = createState();
        var emit = function(isEqual) {
          subscriber.next(isEqual);
          subscriber.complete();
        };
        var createSubscriber = function(selfState, otherState) {
          var sequenceEqualSubscriber = OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(a2) {
            var buffer = otherState.buffer, complete = otherState.complete;
            if (buffer.length === 0) {
              complete ? emit(false) : selfState.buffer.push(a2);
            } else {
              !comparator(a2, buffer.shift()) && emit(false);
            }
          }, function() {
            selfState.complete = true;
            var complete = otherState.complete, buffer = otherState.buffer;
            complete && emit(buffer.length === 0);
            sequenceEqualSubscriber === null || sequenceEqualSubscriber === void 0 ? void 0 : sequenceEqualSubscriber.unsubscribe();
          });
          return sequenceEqualSubscriber;
        };
        source.subscribe(createSubscriber(aState, bState));
        innerFrom_1.innerFrom(compareTo).subscribe(createSubscriber(bState, aState));
      });
    }
    exports.sequenceEqual = sequenceEqual;
    function createState() {
      return {
        buffer: [],
        complete: false
      };
    }
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/share.js
var require_share = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/share.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.share = void 0;
    var innerFrom_1 = require_innerFrom();
    var Subject_1 = require_Subject();
    var Subscriber_1 = require_Subscriber();
    var lift_1 = require_lift();
    function share(options) {
      if (options === void 0) {
        options = {};
      }
      var _a = options.connector, connector = _a === void 0 ? function() {
        return new Subject_1.Subject();
      } : _a, _b = options.resetOnError, resetOnError = _b === void 0 ? true : _b, _c = options.resetOnComplete, resetOnComplete = _c === void 0 ? true : _c, _d = options.resetOnRefCountZero, resetOnRefCountZero = _d === void 0 ? true : _d;
      return function(wrapperSource) {
        var connection;
        var resetConnection;
        var subject;
        var refCount = 0;
        var hasCompleted = false;
        var hasErrored = false;
        var cancelReset = function() {
          resetConnection === null || resetConnection === void 0 ? void 0 : resetConnection.unsubscribe();
          resetConnection = void 0;
        };
        var reset = function() {
          cancelReset();
          connection = subject = void 0;
          hasCompleted = hasErrored = false;
        };
        var resetAndUnsubscribe = function() {
          var conn = connection;
          reset();
          conn === null || conn === void 0 ? void 0 : conn.unsubscribe();
        };
        return lift_1.operate(function(source, subscriber) {
          refCount++;
          if (!hasErrored && !hasCompleted) {
            cancelReset();
          }
          var dest = subject = subject !== null && subject !== void 0 ? subject : connector();
          subscriber.add(function() {
            refCount--;
            if (refCount === 0 && !hasErrored && !hasCompleted) {
              resetConnection = handleReset(resetAndUnsubscribe, resetOnRefCountZero);
            }
          });
          dest.subscribe(subscriber);
          if (!connection && refCount > 0) {
            connection = new Subscriber_1.SafeSubscriber({
              next: function(value) {
                return dest.next(value);
              },
              error: function(err) {
                hasErrored = true;
                cancelReset();
                resetConnection = handleReset(reset, resetOnError, err);
                dest.error(err);
              },
              complete: function() {
                hasCompleted = true;
                cancelReset();
                resetConnection = handleReset(reset, resetOnComplete);
                dest.complete();
              }
            });
            innerFrom_1.innerFrom(source).subscribe(connection);
          }
        })(wrapperSource);
      };
    }
    exports.share = share;
    function handleReset(reset, on) {
      var args = [];
      for (var _i = 2; _i < arguments.length; _i++) {
        args[_i - 2] = arguments[_i];
      }
      if (on === true) {
        reset();
        return;
      }
      if (on === false) {
        return;
      }
      var onSubscriber = new Subscriber_1.SafeSubscriber({
        next: function() {
          onSubscriber.unsubscribe();
          reset();
        }
      });
      return innerFrom_1.innerFrom(on.apply(void 0, __spreadArray([], __read(args)))).subscribe(onSubscriber);
    }
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/shareReplay.js
var require_shareReplay = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/shareReplay.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.shareReplay = void 0;
    var ReplaySubject_1 = require_ReplaySubject();
    var share_1 = require_share();
    function shareReplay(configOrBufferSize, windowTime, scheduler) {
      var _a, _b, _c;
      var bufferSize;
      var refCount = false;
      if (configOrBufferSize && typeof configOrBufferSize === "object") {
        _a = configOrBufferSize.bufferSize, bufferSize = _a === void 0 ? Infinity : _a, _b = configOrBufferSize.windowTime, windowTime = _b === void 0 ? Infinity : _b, _c = configOrBufferSize.refCount, refCount = _c === void 0 ? false : _c, scheduler = configOrBufferSize.scheduler;
      } else {
        bufferSize = configOrBufferSize !== null && configOrBufferSize !== void 0 ? configOrBufferSize : Infinity;
      }
      return share_1.share({
        connector: function() {
          return new ReplaySubject_1.ReplaySubject(bufferSize, windowTime, scheduler);
        },
        resetOnError: true,
        resetOnComplete: false,
        resetOnRefCountZero: refCount
      });
    }
    exports.shareReplay = shareReplay;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/single.js
var require_single = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/single.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.single = void 0;
    var EmptyError_1 = require_EmptyError();
    var SequenceError_1 = require_SequenceError();
    var NotFoundError_1 = require_NotFoundError();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function single(predicate) {
      return lift_1.operate(function(source, subscriber) {
        var hasValue = false;
        var singleValue;
        var seenValue = false;
        var index = 0;
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          seenValue = true;
          if (!predicate || predicate(value, index++, source)) {
            hasValue && subscriber.error(new SequenceError_1.SequenceError("Too many matching values"));
            hasValue = true;
            singleValue = value;
          }
        }, function() {
          if (hasValue) {
            subscriber.next(singleValue);
            subscriber.complete();
          } else {
            subscriber.error(seenValue ? new NotFoundError_1.NotFoundError("No matching values") : new EmptyError_1.EmptyError());
          }
        }));
      });
    }
    exports.single = single;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/skip.js
var require_skip = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/skip.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.skip = void 0;
    var filter_1 = require_filter();
    function skip(count) {
      return filter_1.filter(function(_2, index) {
        return count <= index;
      });
    }
    exports.skip = skip;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/skipLast.js
var require_skipLast = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/skipLast.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.skipLast = void 0;
    var identity_1 = require_identity();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function skipLast(skipCount) {
      return skipCount <= 0 ? identity_1.identity : lift_1.operate(function(source, subscriber) {
        var ring = new Array(skipCount);
        var seen = 0;
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          var valueIndex = seen++;
          if (valueIndex < skipCount) {
            ring[valueIndex] = value;
          } else {
            var index = valueIndex % skipCount;
            var oldValue = ring[index];
            ring[index] = value;
            subscriber.next(oldValue);
          }
        }));
        return function() {
          ring = null;
        };
      });
    }
    exports.skipLast = skipLast;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/skipUntil.js
var require_skipUntil = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/skipUntil.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.skipUntil = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var innerFrom_1 = require_innerFrom();
    var noop_1 = require_noop();
    function skipUntil(notifier) {
      return lift_1.operate(function(source, subscriber) {
        var taking = false;
        var skipSubscriber = OperatorSubscriber_1.createOperatorSubscriber(subscriber, function() {
          skipSubscriber === null || skipSubscriber === void 0 ? void 0 : skipSubscriber.unsubscribe();
          taking = true;
        }, noop_1.noop);
        innerFrom_1.innerFrom(notifier).subscribe(skipSubscriber);
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          return taking && subscriber.next(value);
        }));
      });
    }
    exports.skipUntil = skipUntil;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/skipWhile.js
var require_skipWhile = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/skipWhile.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.skipWhile = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function skipWhile(predicate) {
      return lift_1.operate(function(source, subscriber) {
        var taking = false;
        var index = 0;
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          return (taking || (taking = !predicate(value, index++))) && subscriber.next(value);
        }));
      });
    }
    exports.skipWhile = skipWhile;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/startWith.js
var require_startWith = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/startWith.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.startWith = void 0;
    var concat_1 = require_concat();
    var args_1 = require_args();
    var lift_1 = require_lift();
    function startWith() {
      var values = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        values[_i] = arguments[_i];
      }
      var scheduler = args_1.popScheduler(values);
      return lift_1.operate(function(source, subscriber) {
        (scheduler ? concat_1.concat(values, source, scheduler) : concat_1.concat(values, source)).subscribe(subscriber);
      });
    }
    exports.startWith = startWith;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/switchMap.js
var require_switchMap = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/switchMap.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.switchMap = void 0;
    var innerFrom_1 = require_innerFrom();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function switchMap(project, resultSelector) {
      return lift_1.operate(function(source, subscriber) {
        var innerSubscriber = null;
        var index = 0;
        var isComplete = false;
        var checkComplete = function() {
          return isComplete && !innerSubscriber && subscriber.complete();
        };
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          innerSubscriber === null || innerSubscriber === void 0 ? void 0 : innerSubscriber.unsubscribe();
          var innerIndex = 0;
          var outerIndex = index++;
          innerFrom_1.innerFrom(project(value, outerIndex)).subscribe(innerSubscriber = OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(innerValue) {
            return subscriber.next(resultSelector ? resultSelector(value, innerValue, outerIndex, innerIndex++) : innerValue);
          }, function() {
            innerSubscriber = null;
            checkComplete();
          }));
        }, function() {
          isComplete = true;
          checkComplete();
        }));
      });
    }
    exports.switchMap = switchMap;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/switchAll.js
var require_switchAll = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/switchAll.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.switchAll = void 0;
    var switchMap_1 = require_switchMap();
    var identity_1 = require_identity();
    function switchAll() {
      return switchMap_1.switchMap(identity_1.identity);
    }
    exports.switchAll = switchAll;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/switchMapTo.js
var require_switchMapTo = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/switchMapTo.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.switchMapTo = void 0;
    var switchMap_1 = require_switchMap();
    var isFunction_1 = require_isFunction();
    function switchMapTo(innerObservable, resultSelector) {
      return isFunction_1.isFunction(resultSelector) ? switchMap_1.switchMap(function() {
        return innerObservable;
      }, resultSelector) : switchMap_1.switchMap(function() {
        return innerObservable;
      });
    }
    exports.switchMapTo = switchMapTo;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/switchScan.js
var require_switchScan = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/switchScan.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.switchScan = void 0;
    var switchMap_1 = require_switchMap();
    var lift_1 = require_lift();
    function switchScan(accumulator, seed) {
      return lift_1.operate(function(source, subscriber) {
        var state = seed;
        switchMap_1.switchMap(function(value, index) {
          return accumulator(state, value, index);
        }, function(_2, innerValue) {
          return state = innerValue, innerValue;
        })(source).subscribe(subscriber);
        return function() {
          state = null;
        };
      });
    }
    exports.switchScan = switchScan;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/takeUntil.js
var require_takeUntil = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/takeUntil.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.takeUntil = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var innerFrom_1 = require_innerFrom();
    var noop_1 = require_noop();
    function takeUntil(notifier) {
      return lift_1.operate(function(source, subscriber) {
        innerFrom_1.innerFrom(notifier).subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function() {
          return subscriber.complete();
        }, noop_1.noop));
        !subscriber.closed && source.subscribe(subscriber);
      });
    }
    exports.takeUntil = takeUntil;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/takeWhile.js
var require_takeWhile = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/takeWhile.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.takeWhile = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function takeWhile(predicate, inclusive) {
      if (inclusive === void 0) {
        inclusive = false;
      }
      return lift_1.operate(function(source, subscriber) {
        var index = 0;
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          var result = predicate(value, index++);
          (result || inclusive) && subscriber.next(value);
          !result && subscriber.complete();
        }));
      });
    }
    exports.takeWhile = takeWhile;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/tap.js
var require_tap = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/tap.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.tap = void 0;
    var isFunction_1 = require_isFunction();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var identity_1 = require_identity();
    function tap(observerOrNext, error, complete) {
      var tapObserver = isFunction_1.isFunction(observerOrNext) || error || complete ? { next: observerOrNext, error, complete } : observerOrNext;
      return tapObserver ? lift_1.operate(function(source, subscriber) {
        var _a;
        (_a = tapObserver.subscribe) === null || _a === void 0 ? void 0 : _a.call(tapObserver);
        var isUnsub = true;
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          var _a2;
          (_a2 = tapObserver.next) === null || _a2 === void 0 ? void 0 : _a2.call(tapObserver, value);
          subscriber.next(value);
        }, function() {
          var _a2;
          isUnsub = false;
          (_a2 = tapObserver.complete) === null || _a2 === void 0 ? void 0 : _a2.call(tapObserver);
          subscriber.complete();
        }, function(err) {
          var _a2;
          isUnsub = false;
          (_a2 = tapObserver.error) === null || _a2 === void 0 ? void 0 : _a2.call(tapObserver, err);
          subscriber.error(err);
        }, function() {
          var _a2, _b;
          if (isUnsub) {
            (_a2 = tapObserver.unsubscribe) === null || _a2 === void 0 ? void 0 : _a2.call(tapObserver);
          }
          (_b = tapObserver.finalize) === null || _b === void 0 ? void 0 : _b.call(tapObserver);
        }));
      }) : identity_1.identity;
    }
    exports.tap = tap;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/throttle.js
var require_throttle = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/throttle.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.throttle = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var innerFrom_1 = require_innerFrom();
    function throttle(durationSelector, config) {
      return lift_1.operate(function(source, subscriber) {
        var _a = config !== null && config !== void 0 ? config : {}, _b = _a.leading, leading = _b === void 0 ? true : _b, _c = _a.trailing, trailing = _c === void 0 ? false : _c;
        var hasValue = false;
        var sendValue = null;
        var throttled = null;
        var isComplete = false;
        var endThrottling = function() {
          throttled === null || throttled === void 0 ? void 0 : throttled.unsubscribe();
          throttled = null;
          if (trailing) {
            send();
            isComplete && subscriber.complete();
          }
        };
        var cleanupThrottling = function() {
          throttled = null;
          isComplete && subscriber.complete();
        };
        var startThrottle = function(value) {
          return throttled = innerFrom_1.innerFrom(durationSelector(value)).subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, endThrottling, cleanupThrottling));
        };
        var send = function() {
          if (hasValue) {
            hasValue = false;
            var value = sendValue;
            sendValue = null;
            subscriber.next(value);
            !isComplete && startThrottle(value);
          }
        };
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          hasValue = true;
          sendValue = value;
          !(throttled && !throttled.closed) && (leading ? send() : startThrottle(value));
        }, function() {
          isComplete = true;
          !(trailing && hasValue && throttled && !throttled.closed) && subscriber.complete();
        }));
      });
    }
    exports.throttle = throttle;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/throttleTime.js
var require_throttleTime = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/throttleTime.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.throttleTime = void 0;
    var async_1 = require_async();
    var throttle_1 = require_throttle();
    var timer_1 = require_timer();
    function throttleTime(duration, scheduler, config) {
      if (scheduler === void 0) {
        scheduler = async_1.asyncScheduler;
      }
      var duration$ = timer_1.timer(duration, scheduler);
      return throttle_1.throttle(function() {
        return duration$;
      }, config);
    }
    exports.throttleTime = throttleTime;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/timeInterval.js
var require_timeInterval = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/timeInterval.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TimeInterval = exports.timeInterval = void 0;
    var async_1 = require_async();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function timeInterval(scheduler) {
      if (scheduler === void 0) {
        scheduler = async_1.asyncScheduler;
      }
      return lift_1.operate(function(source, subscriber) {
        var last = scheduler.now();
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          var now = scheduler.now();
          var interval = now - last;
          last = now;
          subscriber.next(new TimeInterval(value, interval));
        }));
      });
    }
    exports.timeInterval = timeInterval;
    var TimeInterval = /* @__PURE__ */ (function() {
      function TimeInterval2(value, interval) {
        this.value = value;
        this.interval = interval;
      }
      return TimeInterval2;
    })();
    exports.TimeInterval = TimeInterval;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/timeoutWith.js
var require_timeoutWith = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/timeoutWith.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.timeoutWith = void 0;
    var async_1 = require_async();
    var isDate_1 = require_isDate();
    var timeout_1 = require_timeout();
    function timeoutWith(due, withObservable, scheduler) {
      var first;
      var each;
      var _with;
      scheduler = scheduler !== null && scheduler !== void 0 ? scheduler : async_1.async;
      if (isDate_1.isValidDate(due)) {
        first = due;
      } else if (typeof due === "number") {
        each = due;
      }
      if (withObservable) {
        _with = function() {
          return withObservable;
        };
      } else {
        throw new TypeError("No observable provided to switch to");
      }
      if (first == null && each == null) {
        throw new TypeError("No timeout provided.");
      }
      return timeout_1.timeout({
        first,
        each,
        scheduler,
        with: _with
      });
    }
    exports.timeoutWith = timeoutWith;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/timestamp.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.timestamp = void 0;
    var dateTimestampProvider_1 = require_dateTimestampProvider();
    var map_1 = require_map();
    function timestamp(timestampProvider) {
      if (timestampProvider === void 0) {
        timestampProvider = dateTimestampProvider_1.dateTimestampProvider;
      }
      return map_1.map(function(value) {
        return { value, timestamp: timestampProvider.now() };
      });
    }
    exports.timestamp = timestamp;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/window.js
var require_window = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/window.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.window = void 0;
    var Subject_1 = require_Subject();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var noop_1 = require_noop();
    var innerFrom_1 = require_innerFrom();
    function window2(windowBoundaries) {
      return lift_1.operate(function(source, subscriber) {
        var windowSubject = new Subject_1.Subject();
        subscriber.next(windowSubject.asObservable());
        var errorHandler = function(err) {
          windowSubject.error(err);
          subscriber.error(err);
        };
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          return windowSubject === null || windowSubject === void 0 ? void 0 : windowSubject.next(value);
        }, function() {
          windowSubject.complete();
          subscriber.complete();
        }, errorHandler));
        innerFrom_1.innerFrom(windowBoundaries).subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function() {
          windowSubject.complete();
          subscriber.next(windowSubject = new Subject_1.Subject());
        }, noop_1.noop, errorHandler));
        return function() {
          windowSubject === null || windowSubject === void 0 ? void 0 : windowSubject.unsubscribe();
          windowSubject = null;
        };
      });
    }
    exports.window = window2;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/windowCount.js
var require_windowCount = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/windowCount.js"(exports) {
    "use strict";
    var __values = exports && exports.__values || function(o2) {
      var s2 = typeof Symbol === "function" && Symbol.iterator, m2 = s2 && o2[s2], i = 0;
      if (m2) return m2.call(o2);
      if (o2 && typeof o2.length === "number") return {
        next: function() {
          if (o2 && i >= o2.length) o2 = void 0;
          return { value: o2 && o2[i++], done: !o2 };
        }
      };
      throw new TypeError(s2 ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.windowCount = void 0;
    var Subject_1 = require_Subject();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    function windowCount(windowSize, startWindowEvery) {
      if (startWindowEvery === void 0) {
        startWindowEvery = 0;
      }
      var startEvery = startWindowEvery > 0 ? startWindowEvery : windowSize;
      return lift_1.operate(function(source, subscriber) {
        var windows = [new Subject_1.Subject()];
        var starts = [];
        var count = 0;
        subscriber.next(windows[0].asObservable());
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          var e_1, _a;
          try {
            for (var windows_1 = __values(windows), windows_1_1 = windows_1.next(); !windows_1_1.done; windows_1_1 = windows_1.next()) {
              var window_1 = windows_1_1.value;
              window_1.next(value);
            }
          } catch (e_1_1) {
            e_1 = { error: e_1_1 };
          } finally {
            try {
              if (windows_1_1 && !windows_1_1.done && (_a = windows_1.return)) _a.call(windows_1);
            } finally {
              if (e_1) throw e_1.error;
            }
          }
          var c2 = count - windowSize + 1;
          if (c2 >= 0 && c2 % startEvery === 0) {
            windows.shift().complete();
          }
          if (++count % startEvery === 0) {
            var window_2 = new Subject_1.Subject();
            windows.push(window_2);
            subscriber.next(window_2.asObservable());
          }
        }, function() {
          while (windows.length > 0) {
            windows.shift().complete();
          }
          subscriber.complete();
        }, function(err) {
          while (windows.length > 0) {
            windows.shift().error(err);
          }
          subscriber.error(err);
        }, function() {
          starts = null;
          windows = null;
        }));
      });
    }
    exports.windowCount = windowCount;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/windowTime.js
var require_windowTime = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/windowTime.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.windowTime = void 0;
    var Subject_1 = require_Subject();
    var async_1 = require_async();
    var Subscription_1 = require_Subscription();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var arrRemove_1 = require_arrRemove();
    var args_1 = require_args();
    var executeSchedule_1 = require_executeSchedule();
    function windowTime(windowTimeSpan) {
      var _a, _b;
      var otherArgs = [];
      for (var _i = 1; _i < arguments.length; _i++) {
        otherArgs[_i - 1] = arguments[_i];
      }
      var scheduler = (_a = args_1.popScheduler(otherArgs)) !== null && _a !== void 0 ? _a : async_1.asyncScheduler;
      var windowCreationInterval = (_b = otherArgs[0]) !== null && _b !== void 0 ? _b : null;
      var maxWindowSize = otherArgs[1] || Infinity;
      return lift_1.operate(function(source, subscriber) {
        var windowRecords = [];
        var restartOnClose = false;
        var closeWindow = function(record) {
          var window2 = record.window, subs = record.subs;
          window2.complete();
          subs.unsubscribe();
          arrRemove_1.arrRemove(windowRecords, record);
          restartOnClose && startWindow();
        };
        var startWindow = function() {
          if (windowRecords) {
            var subs = new Subscription_1.Subscription();
            subscriber.add(subs);
            var window_1 = new Subject_1.Subject();
            var record_1 = {
              window: window_1,
              subs,
              seen: 0
            };
            windowRecords.push(record_1);
            subscriber.next(window_1.asObservable());
            executeSchedule_1.executeSchedule(subs, scheduler, function() {
              return closeWindow(record_1);
            }, windowTimeSpan);
          }
        };
        if (windowCreationInterval !== null && windowCreationInterval >= 0) {
          executeSchedule_1.executeSchedule(subscriber, scheduler, startWindow, windowCreationInterval, true);
        } else {
          restartOnClose = true;
        }
        startWindow();
        var loop = function(cb) {
          return windowRecords.slice().forEach(cb);
        };
        var terminate = function(cb) {
          loop(function(_a2) {
            var window2 = _a2.window;
            return cb(window2);
          });
          cb(subscriber);
          subscriber.unsubscribe();
        };
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          loop(function(record) {
            record.window.next(value);
            maxWindowSize <= ++record.seen && closeWindow(record);
          });
        }, function() {
          return terminate(function(consumer) {
            return consumer.complete();
          });
        }, function(err) {
          return terminate(function(consumer) {
            return consumer.error(err);
          });
        }));
        return function() {
          windowRecords = null;
        };
      });
    }
    exports.windowTime = windowTime;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/windowToggle.js
var require_windowToggle = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/windowToggle.js"(exports) {
    "use strict";
    var __values = exports && exports.__values || function(o2) {
      var s2 = typeof Symbol === "function" && Symbol.iterator, m2 = s2 && o2[s2], i = 0;
      if (m2) return m2.call(o2);
      if (o2 && typeof o2.length === "number") return {
        next: function() {
          if (o2 && i >= o2.length) o2 = void 0;
          return { value: o2 && o2[i++], done: !o2 };
        }
      };
      throw new TypeError(s2 ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.windowToggle = void 0;
    var Subject_1 = require_Subject();
    var Subscription_1 = require_Subscription();
    var lift_1 = require_lift();
    var innerFrom_1 = require_innerFrom();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var noop_1 = require_noop();
    var arrRemove_1 = require_arrRemove();
    function windowToggle(openings, closingSelector) {
      return lift_1.operate(function(source, subscriber) {
        var windows = [];
        var handleError = function(err) {
          while (0 < windows.length) {
            windows.shift().error(err);
          }
          subscriber.error(err);
        };
        innerFrom_1.innerFrom(openings).subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(openValue) {
          var window2 = new Subject_1.Subject();
          windows.push(window2);
          var closingSubscription = new Subscription_1.Subscription();
          var closeWindow = function() {
            arrRemove_1.arrRemove(windows, window2);
            window2.complete();
            closingSubscription.unsubscribe();
          };
          var closingNotifier;
          try {
            closingNotifier = innerFrom_1.innerFrom(closingSelector(openValue));
          } catch (err) {
            handleError(err);
            return;
          }
          subscriber.next(window2.asObservable());
          closingSubscription.add(closingNotifier.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, closeWindow, noop_1.noop, handleError)));
        }, noop_1.noop));
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          var e_1, _a;
          var windowsCopy = windows.slice();
          try {
            for (var windowsCopy_1 = __values(windowsCopy), windowsCopy_1_1 = windowsCopy_1.next(); !windowsCopy_1_1.done; windowsCopy_1_1 = windowsCopy_1.next()) {
              var window_1 = windowsCopy_1_1.value;
              window_1.next(value);
            }
          } catch (e_1_1) {
            e_1 = { error: e_1_1 };
          } finally {
            try {
              if (windowsCopy_1_1 && !windowsCopy_1_1.done && (_a = windowsCopy_1.return)) _a.call(windowsCopy_1);
            } finally {
              if (e_1) throw e_1.error;
            }
          }
        }, function() {
          while (0 < windows.length) {
            windows.shift().complete();
          }
          subscriber.complete();
        }, handleError, function() {
          while (0 < windows.length) {
            windows.shift().unsubscribe();
          }
        }));
      });
    }
    exports.windowToggle = windowToggle;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/windowWhen.js
var require_windowWhen = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/windowWhen.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.windowWhen = void 0;
    var Subject_1 = require_Subject();
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var innerFrom_1 = require_innerFrom();
    function windowWhen(closingSelector) {
      return lift_1.operate(function(source, subscriber) {
        var window2;
        var closingSubscriber;
        var handleError = function(err) {
          window2.error(err);
          subscriber.error(err);
        };
        var openWindow = function() {
          closingSubscriber === null || closingSubscriber === void 0 ? void 0 : closingSubscriber.unsubscribe();
          window2 === null || window2 === void 0 ? void 0 : window2.complete();
          window2 = new Subject_1.Subject();
          subscriber.next(window2.asObservable());
          var closingNotifier;
          try {
            closingNotifier = innerFrom_1.innerFrom(closingSelector());
          } catch (err) {
            handleError(err);
            return;
          }
          closingNotifier.subscribe(closingSubscriber = OperatorSubscriber_1.createOperatorSubscriber(subscriber, openWindow, openWindow, handleError));
        };
        openWindow();
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          return window2.next(value);
        }, function() {
          window2.complete();
          subscriber.complete();
        }, handleError, function() {
          closingSubscriber === null || closingSubscriber === void 0 ? void 0 : closingSubscriber.unsubscribe();
          window2 = null;
        }));
      });
    }
    exports.windowWhen = windowWhen;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/withLatestFrom.js
var require_withLatestFrom = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/withLatestFrom.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.withLatestFrom = void 0;
    var lift_1 = require_lift();
    var OperatorSubscriber_1 = require_OperatorSubscriber();
    var innerFrom_1 = require_innerFrom();
    var identity_1 = require_identity();
    var noop_1 = require_noop();
    var args_1 = require_args();
    function withLatestFrom() {
      var inputs = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        inputs[_i] = arguments[_i];
      }
      var project = args_1.popResultSelector(inputs);
      return lift_1.operate(function(source, subscriber) {
        var len = inputs.length;
        var otherValues = new Array(len);
        var hasValue = inputs.map(function() {
          return false;
        });
        var ready = false;
        var _loop_1 = function(i2) {
          innerFrom_1.innerFrom(inputs[i2]).subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
            otherValues[i2] = value;
            if (!ready && !hasValue[i2]) {
              hasValue[i2] = true;
              (ready = hasValue.every(identity_1.identity)) && (hasValue = null);
            }
          }, noop_1.noop));
        };
        for (var i = 0; i < len; i++) {
          _loop_1(i);
        }
        source.subscribe(OperatorSubscriber_1.createOperatorSubscriber(subscriber, function(value) {
          if (ready) {
            var values = __spreadArray([value], __read(otherValues));
            subscriber.next(project ? project.apply(void 0, __spreadArray([], __read(values))) : values);
          }
        }));
      });
    }
    exports.withLatestFrom = withLatestFrom;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/zipAll.js
var require_zipAll = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/zipAll.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.zipAll = void 0;
    var zip_1 = require_zip();
    var joinAllInternals_1 = require_joinAllInternals();
    function zipAll(project) {
      return joinAllInternals_1.joinAllInternals(zip_1.zip, project);
    }
    exports.zipAll = zipAll;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/zip.js
var require_zip2 = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/zip.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.zip = void 0;
    var zip_1 = require_zip();
    var lift_1 = require_lift();
    function zip() {
      var sources = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        sources[_i] = arguments[_i];
      }
      return lift_1.operate(function(source, subscriber) {
        zip_1.zip.apply(void 0, __spreadArray([source], __read(sources))).subscribe(subscriber);
      });
    }
    exports.zip = zip;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/zipWith.js
var require_zipWith = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/zipWith.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.zipWith = void 0;
    var zip_1 = require_zip2();
    function zipWith() {
      var otherInputs = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        otherInputs[_i] = arguments[_i];
      }
      return zip_1.zip.apply(void 0, __spreadArray([], __read(otherInputs)));
    }
    exports.zipWith = zipWith;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/index.js
var require_cjs = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o2, m2, k2, k22) {
      if (k22 === void 0) k22 = k2;
      Object.defineProperty(o2, k22, { enumerable: true, get: function() {
        return m2[k2];
      } });
    }) : (function(o2, m2, k2, k22) {
      if (k22 === void 0) k22 = k2;
      o2[k22] = m2[k2];
    }));
    var __exportStar = exports && exports.__exportStar || function(m2, exports2) {
      for (var p2 in m2) if (p2 !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p2)) __createBinding(exports2, m2, p2);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.interval = exports.iif = exports.generate = exports.fromEventPattern = exports.fromEvent = exports.from = exports.forkJoin = exports.empty = exports.defer = exports.connectable = exports.concat = exports.combineLatest = exports.bindNodeCallback = exports.bindCallback = exports.UnsubscriptionError = exports.TimeoutError = exports.SequenceError = exports.ObjectUnsubscribedError = exports.NotFoundError = exports.EmptyError = exports.ArgumentOutOfRangeError = exports.firstValueFrom = exports.lastValueFrom = exports.isObservable = exports.identity = exports.noop = exports.pipe = exports.NotificationKind = exports.Notification = exports.Subscriber = exports.Subscription = exports.Scheduler = exports.VirtualAction = exports.VirtualTimeScheduler = exports.animationFrameScheduler = exports.animationFrame = exports.queueScheduler = exports.queue = exports.asyncScheduler = exports.async = exports.asapScheduler = exports.asap = exports.AsyncSubject = exports.ReplaySubject = exports.BehaviorSubject = exports.Subject = exports.animationFrames = exports.observable = exports.ConnectableObservable = exports.Observable = void 0;
    exports.filter = exports.expand = exports.exhaustMap = exports.exhaustAll = exports.exhaust = exports.every = exports.endWith = exports.elementAt = exports.distinctUntilKeyChanged = exports.distinctUntilChanged = exports.distinct = exports.dematerialize = exports.delayWhen = exports.delay = exports.defaultIfEmpty = exports.debounceTime = exports.debounce = exports.count = exports.connect = exports.concatWith = exports.concatMapTo = exports.concatMap = exports.concatAll = exports.combineLatestWith = exports.combineLatestAll = exports.combineAll = exports.catchError = exports.bufferWhen = exports.bufferToggle = exports.bufferTime = exports.bufferCount = exports.buffer = exports.auditTime = exports.audit = exports.config = exports.NEVER = exports.EMPTY = exports.scheduled = exports.zip = exports.using = exports.timer = exports.throwError = exports.range = exports.race = exports.partition = exports.pairs = exports.onErrorResumeNext = exports.of = exports.never = exports.merge = void 0;
    exports.switchMap = exports.switchAll = exports.subscribeOn = exports.startWith = exports.skipWhile = exports.skipUntil = exports.skipLast = exports.skip = exports.single = exports.shareReplay = exports.share = exports.sequenceEqual = exports.scan = exports.sampleTime = exports.sample = exports.refCount = exports.retryWhen = exports.retry = exports.repeatWhen = exports.repeat = exports.reduce = exports.raceWith = exports.publishReplay = exports.publishLast = exports.publishBehavior = exports.publish = exports.pluck = exports.pairwise = exports.onErrorResumeNextWith = exports.observeOn = exports.multicast = exports.min = exports.mergeWith = exports.mergeScan = exports.mergeMapTo = exports.mergeMap = exports.flatMap = exports.mergeAll = exports.max = exports.materialize = exports.mapTo = exports.map = exports.last = exports.isEmpty = exports.ignoreElements = exports.groupBy = exports.first = exports.findIndex = exports.find = exports.finalize = void 0;
    exports.zipWith = exports.zipAll = exports.withLatestFrom = exports.windowWhen = exports.windowToggle = exports.windowTime = exports.windowCount = exports.window = exports.toArray = exports.timestamp = exports.timeoutWith = exports.timeout = exports.timeInterval = exports.throwIfEmpty = exports.throttleTime = exports.throttle = exports.tap = exports.takeWhile = exports.takeUntil = exports.takeLast = exports.take = exports.switchScan = exports.switchMapTo = void 0;
    var Observable_1 = require_Observable();
    Object.defineProperty(exports, "Observable", { enumerable: true, get: function() {
      return Observable_1.Observable;
    } });
    var ConnectableObservable_1 = require_ConnectableObservable();
    Object.defineProperty(exports, "ConnectableObservable", { enumerable: true, get: function() {
      return ConnectableObservable_1.ConnectableObservable;
    } });
    var observable_1 = require_observable();
    Object.defineProperty(exports, "observable", { enumerable: true, get: function() {
      return observable_1.observable;
    } });
    var animationFrames_1 = require_animationFrames();
    Object.defineProperty(exports, "animationFrames", { enumerable: true, get: function() {
      return animationFrames_1.animationFrames;
    } });
    var Subject_1 = require_Subject();
    Object.defineProperty(exports, "Subject", { enumerable: true, get: function() {
      return Subject_1.Subject;
    } });
    var BehaviorSubject_1 = require_BehaviorSubject();
    Object.defineProperty(exports, "BehaviorSubject", { enumerable: true, get: function() {
      return BehaviorSubject_1.BehaviorSubject;
    } });
    var ReplaySubject_1 = require_ReplaySubject();
    Object.defineProperty(exports, "ReplaySubject", { enumerable: true, get: function() {
      return ReplaySubject_1.ReplaySubject;
    } });
    var AsyncSubject_1 = require_AsyncSubject();
    Object.defineProperty(exports, "AsyncSubject", { enumerable: true, get: function() {
      return AsyncSubject_1.AsyncSubject;
    } });
    var asap_1 = require_asap();
    Object.defineProperty(exports, "asap", { enumerable: true, get: function() {
      return asap_1.asap;
    } });
    Object.defineProperty(exports, "asapScheduler", { enumerable: true, get: function() {
      return asap_1.asapScheduler;
    } });
    var async_1 = require_async();
    Object.defineProperty(exports, "async", { enumerable: true, get: function() {
      return async_1.async;
    } });
    Object.defineProperty(exports, "asyncScheduler", { enumerable: true, get: function() {
      return async_1.asyncScheduler;
    } });
    var queue_1 = require_queue();
    Object.defineProperty(exports, "queue", { enumerable: true, get: function() {
      return queue_1.queue;
    } });
    Object.defineProperty(exports, "queueScheduler", { enumerable: true, get: function() {
      return queue_1.queueScheduler;
    } });
    var animationFrame_1 = require_animationFrame();
    Object.defineProperty(exports, "animationFrame", { enumerable: true, get: function() {
      return animationFrame_1.animationFrame;
    } });
    Object.defineProperty(exports, "animationFrameScheduler", { enumerable: true, get: function() {
      return animationFrame_1.animationFrameScheduler;
    } });
    var VirtualTimeScheduler_1 = require_VirtualTimeScheduler();
    Object.defineProperty(exports, "VirtualTimeScheduler", { enumerable: true, get: function() {
      return VirtualTimeScheduler_1.VirtualTimeScheduler;
    } });
    Object.defineProperty(exports, "VirtualAction", { enumerable: true, get: function() {
      return VirtualTimeScheduler_1.VirtualAction;
    } });
    var Scheduler_1 = require_Scheduler();
    Object.defineProperty(exports, "Scheduler", { enumerable: true, get: function() {
      return Scheduler_1.Scheduler;
    } });
    var Subscription_1 = require_Subscription();
    Object.defineProperty(exports, "Subscription", { enumerable: true, get: function() {
      return Subscription_1.Subscription;
    } });
    var Subscriber_1 = require_Subscriber();
    Object.defineProperty(exports, "Subscriber", { enumerable: true, get: function() {
      return Subscriber_1.Subscriber;
    } });
    var Notification_1 = require_Notification();
    Object.defineProperty(exports, "Notification", { enumerable: true, get: function() {
      return Notification_1.Notification;
    } });
    Object.defineProperty(exports, "NotificationKind", { enumerable: true, get: function() {
      return Notification_1.NotificationKind;
    } });
    var pipe_1 = require_pipe();
    Object.defineProperty(exports, "pipe", { enumerable: true, get: function() {
      return pipe_1.pipe;
    } });
    var noop_1 = require_noop();
    Object.defineProperty(exports, "noop", { enumerable: true, get: function() {
      return noop_1.noop;
    } });
    var identity_1 = require_identity();
    Object.defineProperty(exports, "identity", { enumerable: true, get: function() {
      return identity_1.identity;
    } });
    var isObservable_1 = require_isObservable();
    Object.defineProperty(exports, "isObservable", { enumerable: true, get: function() {
      return isObservable_1.isObservable;
    } });
    var lastValueFrom_1 = require_lastValueFrom();
    Object.defineProperty(exports, "lastValueFrom", { enumerable: true, get: function() {
      return lastValueFrom_1.lastValueFrom;
    } });
    var firstValueFrom_1 = require_firstValueFrom();
    Object.defineProperty(exports, "firstValueFrom", { enumerable: true, get: function() {
      return firstValueFrom_1.firstValueFrom;
    } });
    var ArgumentOutOfRangeError_1 = require_ArgumentOutOfRangeError();
    Object.defineProperty(exports, "ArgumentOutOfRangeError", { enumerable: true, get: function() {
      return ArgumentOutOfRangeError_1.ArgumentOutOfRangeError;
    } });
    var EmptyError_1 = require_EmptyError();
    Object.defineProperty(exports, "EmptyError", { enumerable: true, get: function() {
      return EmptyError_1.EmptyError;
    } });
    var NotFoundError_1 = require_NotFoundError();
    Object.defineProperty(exports, "NotFoundError", { enumerable: true, get: function() {
      return NotFoundError_1.NotFoundError;
    } });
    var ObjectUnsubscribedError_1 = require_ObjectUnsubscribedError();
    Object.defineProperty(exports, "ObjectUnsubscribedError", { enumerable: true, get: function() {
      return ObjectUnsubscribedError_1.ObjectUnsubscribedError;
    } });
    var SequenceError_1 = require_SequenceError();
    Object.defineProperty(exports, "SequenceError", { enumerable: true, get: function() {
      return SequenceError_1.SequenceError;
    } });
    var timeout_1 = require_timeout();
    Object.defineProperty(exports, "TimeoutError", { enumerable: true, get: function() {
      return timeout_1.TimeoutError;
    } });
    var UnsubscriptionError_1 = require_UnsubscriptionError();
    Object.defineProperty(exports, "UnsubscriptionError", { enumerable: true, get: function() {
      return UnsubscriptionError_1.UnsubscriptionError;
    } });
    var bindCallback_1 = require_bindCallback();
    Object.defineProperty(exports, "bindCallback", { enumerable: true, get: function() {
      return bindCallback_1.bindCallback;
    } });
    var bindNodeCallback_1 = require_bindNodeCallback();
    Object.defineProperty(exports, "bindNodeCallback", { enumerable: true, get: function() {
      return bindNodeCallback_1.bindNodeCallback;
    } });
    var combineLatest_1 = require_combineLatest();
    Object.defineProperty(exports, "combineLatest", { enumerable: true, get: function() {
      return combineLatest_1.combineLatest;
    } });
    var concat_1 = require_concat();
    Object.defineProperty(exports, "concat", { enumerable: true, get: function() {
      return concat_1.concat;
    } });
    var connectable_1 = require_connectable();
    Object.defineProperty(exports, "connectable", { enumerable: true, get: function() {
      return connectable_1.connectable;
    } });
    var defer_1 = require_defer();
    Object.defineProperty(exports, "defer", { enumerable: true, get: function() {
      return defer_1.defer;
    } });
    var empty_1 = require_empty();
    Object.defineProperty(exports, "empty", { enumerable: true, get: function() {
      return empty_1.empty;
    } });
    var forkJoin_1 = require_forkJoin();
    Object.defineProperty(exports, "forkJoin", { enumerable: true, get: function() {
      return forkJoin_1.forkJoin;
    } });
    var from_1 = require_from();
    Object.defineProperty(exports, "from", { enumerable: true, get: function() {
      return from_1.from;
    } });
    var fromEvent_1 = require_fromEvent();
    Object.defineProperty(exports, "fromEvent", { enumerable: true, get: function() {
      return fromEvent_1.fromEvent;
    } });
    var fromEventPattern_1 = require_fromEventPattern();
    Object.defineProperty(exports, "fromEventPattern", { enumerable: true, get: function() {
      return fromEventPattern_1.fromEventPattern;
    } });
    var generate_1 = require_generate();
    Object.defineProperty(exports, "generate", { enumerable: true, get: function() {
      return generate_1.generate;
    } });
    var iif_1 = require_iif();
    Object.defineProperty(exports, "iif", { enumerable: true, get: function() {
      return iif_1.iif;
    } });
    var interval_1 = require_interval();
    Object.defineProperty(exports, "interval", { enumerable: true, get: function() {
      return interval_1.interval;
    } });
    var merge_1 = require_merge();
    Object.defineProperty(exports, "merge", { enumerable: true, get: function() {
      return merge_1.merge;
    } });
    var never_1 = require_never();
    Object.defineProperty(exports, "never", { enumerable: true, get: function() {
      return never_1.never;
    } });
    var of_1 = require_of();
    Object.defineProperty(exports, "of", { enumerable: true, get: function() {
      return of_1.of;
    } });
    var onErrorResumeNext_1 = require_onErrorResumeNext();
    Object.defineProperty(exports, "onErrorResumeNext", { enumerable: true, get: function() {
      return onErrorResumeNext_1.onErrorResumeNext;
    } });
    var pairs_1 = require_pairs();
    Object.defineProperty(exports, "pairs", { enumerable: true, get: function() {
      return pairs_1.pairs;
    } });
    var partition_1 = require_partition();
    Object.defineProperty(exports, "partition", { enumerable: true, get: function() {
      return partition_1.partition;
    } });
    var race_1 = require_race();
    Object.defineProperty(exports, "race", { enumerable: true, get: function() {
      return race_1.race;
    } });
    var range_1 = require_range();
    Object.defineProperty(exports, "range", { enumerable: true, get: function() {
      return range_1.range;
    } });
    var throwError_1 = require_throwError();
    Object.defineProperty(exports, "throwError", { enumerable: true, get: function() {
      return throwError_1.throwError;
    } });
    var timer_1 = require_timer();
    Object.defineProperty(exports, "timer", { enumerable: true, get: function() {
      return timer_1.timer;
    } });
    var using_1 = require_using();
    Object.defineProperty(exports, "using", { enumerable: true, get: function() {
      return using_1.using;
    } });
    var zip_1 = require_zip();
    Object.defineProperty(exports, "zip", { enumerable: true, get: function() {
      return zip_1.zip;
    } });
    var scheduled_1 = require_scheduled();
    Object.defineProperty(exports, "scheduled", { enumerable: true, get: function() {
      return scheduled_1.scheduled;
    } });
    var empty_2 = require_empty();
    Object.defineProperty(exports, "EMPTY", { enumerable: true, get: function() {
      return empty_2.EMPTY;
    } });
    var never_2 = require_never();
    Object.defineProperty(exports, "NEVER", { enumerable: true, get: function() {
      return never_2.NEVER;
    } });
    __exportStar(require_types(), exports);
    var config_1 = require_config();
    Object.defineProperty(exports, "config", { enumerable: true, get: function() {
      return config_1.config;
    } });
    var audit_1 = require_audit();
    Object.defineProperty(exports, "audit", { enumerable: true, get: function() {
      return audit_1.audit;
    } });
    var auditTime_1 = require_auditTime();
    Object.defineProperty(exports, "auditTime", { enumerable: true, get: function() {
      return auditTime_1.auditTime;
    } });
    var buffer_1 = require_buffer();
    Object.defineProperty(exports, "buffer", { enumerable: true, get: function() {
      return buffer_1.buffer;
    } });
    var bufferCount_1 = require_bufferCount();
    Object.defineProperty(exports, "bufferCount", { enumerable: true, get: function() {
      return bufferCount_1.bufferCount;
    } });
    var bufferTime_1 = require_bufferTime();
    Object.defineProperty(exports, "bufferTime", { enumerable: true, get: function() {
      return bufferTime_1.bufferTime;
    } });
    var bufferToggle_1 = require_bufferToggle();
    Object.defineProperty(exports, "bufferToggle", { enumerable: true, get: function() {
      return bufferToggle_1.bufferToggle;
    } });
    var bufferWhen_1 = require_bufferWhen();
    Object.defineProperty(exports, "bufferWhen", { enumerable: true, get: function() {
      return bufferWhen_1.bufferWhen;
    } });
    var catchError_1 = require_catchError();
    Object.defineProperty(exports, "catchError", { enumerable: true, get: function() {
      return catchError_1.catchError;
    } });
    var combineAll_1 = require_combineAll();
    Object.defineProperty(exports, "combineAll", { enumerable: true, get: function() {
      return combineAll_1.combineAll;
    } });
    var combineLatestAll_1 = require_combineLatestAll();
    Object.defineProperty(exports, "combineLatestAll", { enumerable: true, get: function() {
      return combineLatestAll_1.combineLatestAll;
    } });
    var combineLatestWith_1 = require_combineLatestWith();
    Object.defineProperty(exports, "combineLatestWith", { enumerable: true, get: function() {
      return combineLatestWith_1.combineLatestWith;
    } });
    var concatAll_1 = require_concatAll();
    Object.defineProperty(exports, "concatAll", { enumerable: true, get: function() {
      return concatAll_1.concatAll;
    } });
    var concatMap_1 = require_concatMap();
    Object.defineProperty(exports, "concatMap", { enumerable: true, get: function() {
      return concatMap_1.concatMap;
    } });
    var concatMapTo_1 = require_concatMapTo();
    Object.defineProperty(exports, "concatMapTo", { enumerable: true, get: function() {
      return concatMapTo_1.concatMapTo;
    } });
    var concatWith_1 = require_concatWith();
    Object.defineProperty(exports, "concatWith", { enumerable: true, get: function() {
      return concatWith_1.concatWith;
    } });
    var connect_1 = require_connect();
    Object.defineProperty(exports, "connect", { enumerable: true, get: function() {
      return connect_1.connect;
    } });
    var count_1 = require_count();
    Object.defineProperty(exports, "count", { enumerable: true, get: function() {
      return count_1.count;
    } });
    var debounce_1 = require_debounce();
    Object.defineProperty(exports, "debounce", { enumerable: true, get: function() {
      return debounce_1.debounce;
    } });
    var debounceTime_1 = require_debounceTime();
    Object.defineProperty(exports, "debounceTime", { enumerable: true, get: function() {
      return debounceTime_1.debounceTime;
    } });
    var defaultIfEmpty_1 = require_defaultIfEmpty();
    Object.defineProperty(exports, "defaultIfEmpty", { enumerable: true, get: function() {
      return defaultIfEmpty_1.defaultIfEmpty;
    } });
    var delay_1 = require_delay();
    Object.defineProperty(exports, "delay", { enumerable: true, get: function() {
      return delay_1.delay;
    } });
    var delayWhen_1 = require_delayWhen();
    Object.defineProperty(exports, "delayWhen", { enumerable: true, get: function() {
      return delayWhen_1.delayWhen;
    } });
    var dematerialize_1 = require_dematerialize();
    Object.defineProperty(exports, "dematerialize", { enumerable: true, get: function() {
      return dematerialize_1.dematerialize;
    } });
    var distinct_1 = require_distinct();
    Object.defineProperty(exports, "distinct", { enumerable: true, get: function() {
      return distinct_1.distinct;
    } });
    var distinctUntilChanged_1 = require_distinctUntilChanged();
    Object.defineProperty(exports, "distinctUntilChanged", { enumerable: true, get: function() {
      return distinctUntilChanged_1.distinctUntilChanged;
    } });
    var distinctUntilKeyChanged_1 = require_distinctUntilKeyChanged();
    Object.defineProperty(exports, "distinctUntilKeyChanged", { enumerable: true, get: function() {
      return distinctUntilKeyChanged_1.distinctUntilKeyChanged;
    } });
    var elementAt_1 = require_elementAt();
    Object.defineProperty(exports, "elementAt", { enumerable: true, get: function() {
      return elementAt_1.elementAt;
    } });
    var endWith_1 = require_endWith();
    Object.defineProperty(exports, "endWith", { enumerable: true, get: function() {
      return endWith_1.endWith;
    } });
    var every_1 = require_every();
    Object.defineProperty(exports, "every", { enumerable: true, get: function() {
      return every_1.every;
    } });
    var exhaust_1 = require_exhaust();
    Object.defineProperty(exports, "exhaust", { enumerable: true, get: function() {
      return exhaust_1.exhaust;
    } });
    var exhaustAll_1 = require_exhaustAll();
    Object.defineProperty(exports, "exhaustAll", { enumerable: true, get: function() {
      return exhaustAll_1.exhaustAll;
    } });
    var exhaustMap_1 = require_exhaustMap();
    Object.defineProperty(exports, "exhaustMap", { enumerable: true, get: function() {
      return exhaustMap_1.exhaustMap;
    } });
    var expand_1 = require_expand();
    Object.defineProperty(exports, "expand", { enumerable: true, get: function() {
      return expand_1.expand;
    } });
    var filter_1 = require_filter();
    Object.defineProperty(exports, "filter", { enumerable: true, get: function() {
      return filter_1.filter;
    } });
    var finalize_1 = require_finalize();
    Object.defineProperty(exports, "finalize", { enumerable: true, get: function() {
      return finalize_1.finalize;
    } });
    var find_1 = require_find();
    Object.defineProperty(exports, "find", { enumerable: true, get: function() {
      return find_1.find;
    } });
    var findIndex_1 = require_findIndex();
    Object.defineProperty(exports, "findIndex", { enumerable: true, get: function() {
      return findIndex_1.findIndex;
    } });
    var first_1 = require_first();
    Object.defineProperty(exports, "first", { enumerable: true, get: function() {
      return first_1.first;
    } });
    var groupBy_1 = require_groupBy();
    Object.defineProperty(exports, "groupBy", { enumerable: true, get: function() {
      return groupBy_1.groupBy;
    } });
    var ignoreElements_1 = require_ignoreElements();
    Object.defineProperty(exports, "ignoreElements", { enumerable: true, get: function() {
      return ignoreElements_1.ignoreElements;
    } });
    var isEmpty_1 = require_isEmpty();
    Object.defineProperty(exports, "isEmpty", { enumerable: true, get: function() {
      return isEmpty_1.isEmpty;
    } });
    var last_1 = require_last();
    Object.defineProperty(exports, "last", { enumerable: true, get: function() {
      return last_1.last;
    } });
    var map_1 = require_map();
    Object.defineProperty(exports, "map", { enumerable: true, get: function() {
      return map_1.map;
    } });
    var mapTo_1 = require_mapTo();
    Object.defineProperty(exports, "mapTo", { enumerable: true, get: function() {
      return mapTo_1.mapTo;
    } });
    var materialize_1 = require_materialize();
    Object.defineProperty(exports, "materialize", { enumerable: true, get: function() {
      return materialize_1.materialize;
    } });
    var max_1 = require_max();
    Object.defineProperty(exports, "max", { enumerable: true, get: function() {
      return max_1.max;
    } });
    var mergeAll_1 = require_mergeAll();
    Object.defineProperty(exports, "mergeAll", { enumerable: true, get: function() {
      return mergeAll_1.mergeAll;
    } });
    var flatMap_1 = require_flatMap();
    Object.defineProperty(exports, "flatMap", { enumerable: true, get: function() {
      return flatMap_1.flatMap;
    } });
    var mergeMap_1 = require_mergeMap();
    Object.defineProperty(exports, "mergeMap", { enumerable: true, get: function() {
      return mergeMap_1.mergeMap;
    } });
    var mergeMapTo_1 = require_mergeMapTo();
    Object.defineProperty(exports, "mergeMapTo", { enumerable: true, get: function() {
      return mergeMapTo_1.mergeMapTo;
    } });
    var mergeScan_1 = require_mergeScan();
    Object.defineProperty(exports, "mergeScan", { enumerable: true, get: function() {
      return mergeScan_1.mergeScan;
    } });
    var mergeWith_1 = require_mergeWith();
    Object.defineProperty(exports, "mergeWith", { enumerable: true, get: function() {
      return mergeWith_1.mergeWith;
    } });
    var min_1 = require_min();
    Object.defineProperty(exports, "min", { enumerable: true, get: function() {
      return min_1.min;
    } });
    var multicast_1 = require_multicast();
    Object.defineProperty(exports, "multicast", { enumerable: true, get: function() {
      return multicast_1.multicast;
    } });
    var observeOn_1 = require_observeOn();
    Object.defineProperty(exports, "observeOn", { enumerable: true, get: function() {
      return observeOn_1.observeOn;
    } });
    var onErrorResumeNextWith_1 = require_onErrorResumeNextWith();
    Object.defineProperty(exports, "onErrorResumeNextWith", { enumerable: true, get: function() {
      return onErrorResumeNextWith_1.onErrorResumeNextWith;
    } });
    var pairwise_1 = require_pairwise();
    Object.defineProperty(exports, "pairwise", { enumerable: true, get: function() {
      return pairwise_1.pairwise;
    } });
    var pluck_1 = require_pluck();
    Object.defineProperty(exports, "pluck", { enumerable: true, get: function() {
      return pluck_1.pluck;
    } });
    var publish_1 = require_publish();
    Object.defineProperty(exports, "publish", { enumerable: true, get: function() {
      return publish_1.publish;
    } });
    var publishBehavior_1 = require_publishBehavior();
    Object.defineProperty(exports, "publishBehavior", { enumerable: true, get: function() {
      return publishBehavior_1.publishBehavior;
    } });
    var publishLast_1 = require_publishLast();
    Object.defineProperty(exports, "publishLast", { enumerable: true, get: function() {
      return publishLast_1.publishLast;
    } });
    var publishReplay_1 = require_publishReplay();
    Object.defineProperty(exports, "publishReplay", { enumerable: true, get: function() {
      return publishReplay_1.publishReplay;
    } });
    var raceWith_1 = require_raceWith();
    Object.defineProperty(exports, "raceWith", { enumerable: true, get: function() {
      return raceWith_1.raceWith;
    } });
    var reduce_1 = require_reduce();
    Object.defineProperty(exports, "reduce", { enumerable: true, get: function() {
      return reduce_1.reduce;
    } });
    var repeat_1 = require_repeat();
    Object.defineProperty(exports, "repeat", { enumerable: true, get: function() {
      return repeat_1.repeat;
    } });
    var repeatWhen_1 = require_repeatWhen();
    Object.defineProperty(exports, "repeatWhen", { enumerable: true, get: function() {
      return repeatWhen_1.repeatWhen;
    } });
    var retry_1 = require_retry();
    Object.defineProperty(exports, "retry", { enumerable: true, get: function() {
      return retry_1.retry;
    } });
    var retryWhen_1 = require_retryWhen();
    Object.defineProperty(exports, "retryWhen", { enumerable: true, get: function() {
      return retryWhen_1.retryWhen;
    } });
    var refCount_1 = require_refCount();
    Object.defineProperty(exports, "refCount", { enumerable: true, get: function() {
      return refCount_1.refCount;
    } });
    var sample_1 = require_sample();
    Object.defineProperty(exports, "sample", { enumerable: true, get: function() {
      return sample_1.sample;
    } });
    var sampleTime_1 = require_sampleTime();
    Object.defineProperty(exports, "sampleTime", { enumerable: true, get: function() {
      return sampleTime_1.sampleTime;
    } });
    var scan_1 = require_scan();
    Object.defineProperty(exports, "scan", { enumerable: true, get: function() {
      return scan_1.scan;
    } });
    var sequenceEqual_1 = require_sequenceEqual();
    Object.defineProperty(exports, "sequenceEqual", { enumerable: true, get: function() {
      return sequenceEqual_1.sequenceEqual;
    } });
    var share_1 = require_share();
    Object.defineProperty(exports, "share", { enumerable: true, get: function() {
      return share_1.share;
    } });
    var shareReplay_1 = require_shareReplay();
    Object.defineProperty(exports, "shareReplay", { enumerable: true, get: function() {
      return shareReplay_1.shareReplay;
    } });
    var single_1 = require_single();
    Object.defineProperty(exports, "single", { enumerable: true, get: function() {
      return single_1.single;
    } });
    var skip_1 = require_skip();
    Object.defineProperty(exports, "skip", { enumerable: true, get: function() {
      return skip_1.skip;
    } });
    var skipLast_1 = require_skipLast();
    Object.defineProperty(exports, "skipLast", { enumerable: true, get: function() {
      return skipLast_1.skipLast;
    } });
    var skipUntil_1 = require_skipUntil();
    Object.defineProperty(exports, "skipUntil", { enumerable: true, get: function() {
      return skipUntil_1.skipUntil;
    } });
    var skipWhile_1 = require_skipWhile();
    Object.defineProperty(exports, "skipWhile", { enumerable: true, get: function() {
      return skipWhile_1.skipWhile;
    } });
    var startWith_1 = require_startWith();
    Object.defineProperty(exports, "startWith", { enumerable: true, get: function() {
      return startWith_1.startWith;
    } });
    var subscribeOn_1 = require_subscribeOn();
    Object.defineProperty(exports, "subscribeOn", { enumerable: true, get: function() {
      return subscribeOn_1.subscribeOn;
    } });
    var switchAll_1 = require_switchAll();
    Object.defineProperty(exports, "switchAll", { enumerable: true, get: function() {
      return switchAll_1.switchAll;
    } });
    var switchMap_1 = require_switchMap();
    Object.defineProperty(exports, "switchMap", { enumerable: true, get: function() {
      return switchMap_1.switchMap;
    } });
    var switchMapTo_1 = require_switchMapTo();
    Object.defineProperty(exports, "switchMapTo", { enumerable: true, get: function() {
      return switchMapTo_1.switchMapTo;
    } });
    var switchScan_1 = require_switchScan();
    Object.defineProperty(exports, "switchScan", { enumerable: true, get: function() {
      return switchScan_1.switchScan;
    } });
    var take_1 = require_take();
    Object.defineProperty(exports, "take", { enumerable: true, get: function() {
      return take_1.take;
    } });
    var takeLast_1 = require_takeLast();
    Object.defineProperty(exports, "takeLast", { enumerable: true, get: function() {
      return takeLast_1.takeLast;
    } });
    var takeUntil_1 = require_takeUntil();
    Object.defineProperty(exports, "takeUntil", { enumerable: true, get: function() {
      return takeUntil_1.takeUntil;
    } });
    var takeWhile_1 = require_takeWhile();
    Object.defineProperty(exports, "takeWhile", { enumerable: true, get: function() {
      return takeWhile_1.takeWhile;
    } });
    var tap_1 = require_tap();
    Object.defineProperty(exports, "tap", { enumerable: true, get: function() {
      return tap_1.tap;
    } });
    var throttle_1 = require_throttle();
    Object.defineProperty(exports, "throttle", { enumerable: true, get: function() {
      return throttle_1.throttle;
    } });
    var throttleTime_1 = require_throttleTime();
    Object.defineProperty(exports, "throttleTime", { enumerable: true, get: function() {
      return throttleTime_1.throttleTime;
    } });
    var throwIfEmpty_1 = require_throwIfEmpty();
    Object.defineProperty(exports, "throwIfEmpty", { enumerable: true, get: function() {
      return throwIfEmpty_1.throwIfEmpty;
    } });
    var timeInterval_1 = require_timeInterval();
    Object.defineProperty(exports, "timeInterval", { enumerable: true, get: function() {
      return timeInterval_1.timeInterval;
    } });
    var timeout_2 = require_timeout();
    Object.defineProperty(exports, "timeout", { enumerable: true, get: function() {
      return timeout_2.timeout;
    } });
    var timeoutWith_1 = require_timeoutWith();
    Object.defineProperty(exports, "timeoutWith", { enumerable: true, get: function() {
      return timeoutWith_1.timeoutWith;
    } });
    var timestamp_1 = require_timestamp();
    Object.defineProperty(exports, "timestamp", { enumerable: true, get: function() {
      return timestamp_1.timestamp;
    } });
    var toArray_1 = require_toArray();
    Object.defineProperty(exports, "toArray", { enumerable: true, get: function() {
      return toArray_1.toArray;
    } });
    var window_1 = require_window();
    Object.defineProperty(exports, "window", { enumerable: true, get: function() {
      return window_1.window;
    } });
    var windowCount_1 = require_windowCount();
    Object.defineProperty(exports, "windowCount", { enumerable: true, get: function() {
      return windowCount_1.windowCount;
    } });
    var windowTime_1 = require_windowTime();
    Object.defineProperty(exports, "windowTime", { enumerable: true, get: function() {
      return windowTime_1.windowTime;
    } });
    var windowToggle_1 = require_windowToggle();
    Object.defineProperty(exports, "windowToggle", { enumerable: true, get: function() {
      return windowToggle_1.windowToggle;
    } });
    var windowWhen_1 = require_windowWhen();
    Object.defineProperty(exports, "windowWhen", { enumerable: true, get: function() {
      return windowWhen_1.windowWhen;
    } });
    var withLatestFrom_1 = require_withLatestFrom();
    Object.defineProperty(exports, "withLatestFrom", { enumerable: true, get: function() {
      return withLatestFrom_1.withLatestFrom;
    } });
    var zipAll_1 = require_zipAll();
    Object.defineProperty(exports, "zipAll", { enumerable: true, get: function() {
      return zipAll_1.zipAll;
    } });
    var zipWith_1 = require_zipWith();
    Object.defineProperty(exports, "zipWith", { enumerable: true, get: function() {
      return zipWith_1.zipWith;
    } });
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/partition.js
var require_partition2 = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/partition.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.partition = void 0;
    var not_1 = require_not();
    var filter_1 = require_filter();
    function partition(predicate, thisArg) {
      return function(source) {
        return [filter_1.filter(predicate, thisArg)(source), filter_1.filter(not_1.not(predicate, thisArg))(source)];
      };
    }
    exports.partition = partition;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/race.js
var require_race2 = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/internal/operators/race.js"(exports) {
    "use strict";
    var __read = exports && exports.__read || function(o2, n) {
      var m2 = typeof Symbol === "function" && o2[Symbol.iterator];
      if (!m2) return o2;
      var i = m2.call(o2), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m2 = i["return"])) m2.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j2 = to.length; i < il; i++, j2++)
        to[j2] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.race = void 0;
    var argsOrArgArray_1 = require_argsOrArgArray();
    var raceWith_1 = require_raceWith();
    function race() {
      var args = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
      }
      return raceWith_1.raceWith.apply(void 0, __spreadArray([], __read(argsOrArgArray_1.argsOrArgArray(args))));
    }
    exports.race = race;
  }
});

// node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/operators/index.js
var require_operators = __commonJS({
  "node_modules/.pnpm/rxjs@7.8.1/node_modules/rxjs/dist/cjs/operators/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.mergeAll = exports.merge = exports.max = exports.materialize = exports.mapTo = exports.map = exports.last = exports.isEmpty = exports.ignoreElements = exports.groupBy = exports.first = exports.findIndex = exports.find = exports.finalize = exports.filter = exports.expand = exports.exhaustMap = exports.exhaustAll = exports.exhaust = exports.every = exports.endWith = exports.elementAt = exports.distinctUntilKeyChanged = exports.distinctUntilChanged = exports.distinct = exports.dematerialize = exports.delayWhen = exports.delay = exports.defaultIfEmpty = exports.debounceTime = exports.debounce = exports.count = exports.connect = exports.concatWith = exports.concatMapTo = exports.concatMap = exports.concatAll = exports.concat = exports.combineLatestWith = exports.combineLatest = exports.combineLatestAll = exports.combineAll = exports.catchError = exports.bufferWhen = exports.bufferToggle = exports.bufferTime = exports.bufferCount = exports.buffer = exports.auditTime = exports.audit = void 0;
    exports.timeInterval = exports.throwIfEmpty = exports.throttleTime = exports.throttle = exports.tap = exports.takeWhile = exports.takeUntil = exports.takeLast = exports.take = exports.switchScan = exports.switchMapTo = exports.switchMap = exports.switchAll = exports.subscribeOn = exports.startWith = exports.skipWhile = exports.skipUntil = exports.skipLast = exports.skip = exports.single = exports.shareReplay = exports.share = exports.sequenceEqual = exports.scan = exports.sampleTime = exports.sample = exports.refCount = exports.retryWhen = exports.retry = exports.repeatWhen = exports.repeat = exports.reduce = exports.raceWith = exports.race = exports.publishReplay = exports.publishLast = exports.publishBehavior = exports.publish = exports.pluck = exports.partition = exports.pairwise = exports.onErrorResumeNext = exports.observeOn = exports.multicast = exports.min = exports.mergeWith = exports.mergeScan = exports.mergeMapTo = exports.mergeMap = exports.flatMap = void 0;
    exports.zipWith = exports.zipAll = exports.zip = exports.withLatestFrom = exports.windowWhen = exports.windowToggle = exports.windowTime = exports.windowCount = exports.window = exports.toArray = exports.timestamp = exports.timeoutWith = exports.timeout = void 0;
    var audit_1 = require_audit();
    Object.defineProperty(exports, "audit", { enumerable: true, get: function() {
      return audit_1.audit;
    } });
    var auditTime_1 = require_auditTime();
    Object.defineProperty(exports, "auditTime", { enumerable: true, get: function() {
      return auditTime_1.auditTime;
    } });
    var buffer_1 = require_buffer();
    Object.defineProperty(exports, "buffer", { enumerable: true, get: function() {
      return buffer_1.buffer;
    } });
    var bufferCount_1 = require_bufferCount();
    Object.defineProperty(exports, "bufferCount", { enumerable: true, get: function() {
      return bufferCount_1.bufferCount;
    } });
    var bufferTime_1 = require_bufferTime();
    Object.defineProperty(exports, "bufferTime", { enumerable: true, get: function() {
      return bufferTime_1.bufferTime;
    } });
    var bufferToggle_1 = require_bufferToggle();
    Object.defineProperty(exports, "bufferToggle", { enumerable: true, get: function() {
      return bufferToggle_1.bufferToggle;
    } });
    var bufferWhen_1 = require_bufferWhen();
    Object.defineProperty(exports, "bufferWhen", { enumerable: true, get: function() {
      return bufferWhen_1.bufferWhen;
    } });
    var catchError_1 = require_catchError();
    Object.defineProperty(exports, "catchError", { enumerable: true, get: function() {
      return catchError_1.catchError;
    } });
    var combineAll_1 = require_combineAll();
    Object.defineProperty(exports, "combineAll", { enumerable: true, get: function() {
      return combineAll_1.combineAll;
    } });
    var combineLatestAll_1 = require_combineLatestAll();
    Object.defineProperty(exports, "combineLatestAll", { enumerable: true, get: function() {
      return combineLatestAll_1.combineLatestAll;
    } });
    var combineLatest_1 = require_combineLatest2();
    Object.defineProperty(exports, "combineLatest", { enumerable: true, get: function() {
      return combineLatest_1.combineLatest;
    } });
    var combineLatestWith_1 = require_combineLatestWith();
    Object.defineProperty(exports, "combineLatestWith", { enumerable: true, get: function() {
      return combineLatestWith_1.combineLatestWith;
    } });
    var concat_1 = require_concat2();
    Object.defineProperty(exports, "concat", { enumerable: true, get: function() {
      return concat_1.concat;
    } });
    var concatAll_1 = require_concatAll();
    Object.defineProperty(exports, "concatAll", { enumerable: true, get: function() {
      return concatAll_1.concatAll;
    } });
    var concatMap_1 = require_concatMap();
    Object.defineProperty(exports, "concatMap", { enumerable: true, get: function() {
      return concatMap_1.concatMap;
    } });
    var concatMapTo_1 = require_concatMapTo();
    Object.defineProperty(exports, "concatMapTo", { enumerable: true, get: function() {
      return concatMapTo_1.concatMapTo;
    } });
    var concatWith_1 = require_concatWith();
    Object.defineProperty(exports, "concatWith", { enumerable: true, get: function() {
      return concatWith_1.concatWith;
    } });
    var connect_1 = require_connect();
    Object.defineProperty(exports, "connect", { enumerable: true, get: function() {
      return connect_1.connect;
    } });
    var count_1 = require_count();
    Object.defineProperty(exports, "count", { enumerable: true, get: function() {
      return count_1.count;
    } });
    var debounce_1 = require_debounce();
    Object.defineProperty(exports, "debounce", { enumerable: true, get: function() {
      return debounce_1.debounce;
    } });
    var debounceTime_1 = require_debounceTime();
    Object.defineProperty(exports, "debounceTime", { enumerable: true, get: function() {
      return debounceTime_1.debounceTime;
    } });
    var defaultIfEmpty_1 = require_defaultIfEmpty();
    Object.defineProperty(exports, "defaultIfEmpty", { enumerable: true, get: function() {
      return defaultIfEmpty_1.defaultIfEmpty;
    } });
    var delay_1 = require_delay();
    Object.defineProperty(exports, "delay", { enumerable: true, get: function() {
      return delay_1.delay;
    } });
    var delayWhen_1 = require_delayWhen();
    Object.defineProperty(exports, "delayWhen", { enumerable: true, get: function() {
      return delayWhen_1.delayWhen;
    } });
    var dematerialize_1 = require_dematerialize();
    Object.defineProperty(exports, "dematerialize", { enumerable: true, get: function() {
      return dematerialize_1.dematerialize;
    } });
    var distinct_1 = require_distinct();
    Object.defineProperty(exports, "distinct", { enumerable: true, get: function() {
      return distinct_1.distinct;
    } });
    var distinctUntilChanged_1 = require_distinctUntilChanged();
    Object.defineProperty(exports, "distinctUntilChanged", { enumerable: true, get: function() {
      return distinctUntilChanged_1.distinctUntilChanged;
    } });
    var distinctUntilKeyChanged_1 = require_distinctUntilKeyChanged();
    Object.defineProperty(exports, "distinctUntilKeyChanged", { enumerable: true, get: function() {
      return distinctUntilKeyChanged_1.distinctUntilKeyChanged;
    } });
    var elementAt_1 = require_elementAt();
    Object.defineProperty(exports, "elementAt", { enumerable: true, get: function() {
      return elementAt_1.elementAt;
    } });
    var endWith_1 = require_endWith();
    Object.defineProperty(exports, "endWith", { enumerable: true, get: function() {
      return endWith_1.endWith;
    } });
    var every_1 = require_every();
    Object.defineProperty(exports, "every", { enumerable: true, get: function() {
      return every_1.every;
    } });
    var exhaust_1 = require_exhaust();
    Object.defineProperty(exports, "exhaust", { enumerable: true, get: function() {
      return exhaust_1.exhaust;
    } });
    var exhaustAll_1 = require_exhaustAll();
    Object.defineProperty(exports, "exhaustAll", { enumerable: true, get: function() {
      return exhaustAll_1.exhaustAll;
    } });
    var exhaustMap_1 = require_exhaustMap();
    Object.defineProperty(exports, "exhaustMap", { enumerable: true, get: function() {
      return exhaustMap_1.exhaustMap;
    } });
    var expand_1 = require_expand();
    Object.defineProperty(exports, "expand", { enumerable: true, get: function() {
      return expand_1.expand;
    } });
    var filter_1 = require_filter();
    Object.defineProperty(exports, "filter", { enumerable: true, get: function() {
      return filter_1.filter;
    } });
    var finalize_1 = require_finalize();
    Object.defineProperty(exports, "finalize", { enumerable: true, get: function() {
      return finalize_1.finalize;
    } });
    var find_1 = require_find();
    Object.defineProperty(exports, "find", { enumerable: true, get: function() {
      return find_1.find;
    } });
    var findIndex_1 = require_findIndex();
    Object.defineProperty(exports, "findIndex", { enumerable: true, get: function() {
      return findIndex_1.findIndex;
    } });
    var first_1 = require_first();
    Object.defineProperty(exports, "first", { enumerable: true, get: function() {
      return first_1.first;
    } });
    var groupBy_1 = require_groupBy();
    Object.defineProperty(exports, "groupBy", { enumerable: true, get: function() {
      return groupBy_1.groupBy;
    } });
    var ignoreElements_1 = require_ignoreElements();
    Object.defineProperty(exports, "ignoreElements", { enumerable: true, get: function() {
      return ignoreElements_1.ignoreElements;
    } });
    var isEmpty_1 = require_isEmpty();
    Object.defineProperty(exports, "isEmpty", { enumerable: true, get: function() {
      return isEmpty_1.isEmpty;
    } });
    var last_1 = require_last();
    Object.defineProperty(exports, "last", { enumerable: true, get: function() {
      return last_1.last;
    } });
    var map_1 = require_map();
    Object.defineProperty(exports, "map", { enumerable: true, get: function() {
      return map_1.map;
    } });
    var mapTo_1 = require_mapTo();
    Object.defineProperty(exports, "mapTo", { enumerable: true, get: function() {
      return mapTo_1.mapTo;
    } });
    var materialize_1 = require_materialize();
    Object.defineProperty(exports, "materialize", { enumerable: true, get: function() {
      return materialize_1.materialize;
    } });
    var max_1 = require_max();
    Object.defineProperty(exports, "max", { enumerable: true, get: function() {
      return max_1.max;
    } });
    var merge_1 = require_merge2();
    Object.defineProperty(exports, "merge", { enumerable: true, get: function() {
      return merge_1.merge;
    } });
    var mergeAll_1 = require_mergeAll();
    Object.defineProperty(exports, "mergeAll", { enumerable: true, get: function() {
      return mergeAll_1.mergeAll;
    } });
    var flatMap_1 = require_flatMap();
    Object.defineProperty(exports, "flatMap", { enumerable: true, get: function() {
      return flatMap_1.flatMap;
    } });
    var mergeMap_1 = require_mergeMap();
    Object.defineProperty(exports, "mergeMap", { enumerable: true, get: function() {
      return mergeMap_1.mergeMap;
    } });
    var mergeMapTo_1 = require_mergeMapTo();
    Object.defineProperty(exports, "mergeMapTo", { enumerable: true, get: function() {
      return mergeMapTo_1.mergeMapTo;
    } });
    var mergeScan_1 = require_mergeScan();
    Object.defineProperty(exports, "mergeScan", { enumerable: true, get: function() {
      return mergeScan_1.mergeScan;
    } });
    var mergeWith_1 = require_mergeWith();
    Object.defineProperty(exports, "mergeWith", { enumerable: true, get: function() {
      return mergeWith_1.mergeWith;
    } });
    var min_1 = require_min();
    Object.defineProperty(exports, "min", { enumerable: true, get: function() {
      return min_1.min;
    } });
    var multicast_1 = require_multicast();
    Object.defineProperty(exports, "multicast", { enumerable: true, get: function() {
      return multicast_1.multicast;
    } });
    var observeOn_1 = require_observeOn();
    Object.defineProperty(exports, "observeOn", { enumerable: true, get: function() {
      return observeOn_1.observeOn;
    } });
    var onErrorResumeNextWith_1 = require_onErrorResumeNextWith();
    Object.defineProperty(exports, "onErrorResumeNext", { enumerable: true, get: function() {
      return onErrorResumeNextWith_1.onErrorResumeNext;
    } });
    var pairwise_1 = require_pairwise();
    Object.defineProperty(exports, "pairwise", { enumerable: true, get: function() {
      return pairwise_1.pairwise;
    } });
    var partition_1 = require_partition2();
    Object.defineProperty(exports, "partition", { enumerable: true, get: function() {
      return partition_1.partition;
    } });
    var pluck_1 = require_pluck();
    Object.defineProperty(exports, "pluck", { enumerable: true, get: function() {
      return pluck_1.pluck;
    } });
    var publish_1 = require_publish();
    Object.defineProperty(exports, "publish", { enumerable: true, get: function() {
      return publish_1.publish;
    } });
    var publishBehavior_1 = require_publishBehavior();
    Object.defineProperty(exports, "publishBehavior", { enumerable: true, get: function() {
      return publishBehavior_1.publishBehavior;
    } });
    var publishLast_1 = require_publishLast();
    Object.defineProperty(exports, "publishLast", { enumerable: true, get: function() {
      return publishLast_1.publishLast;
    } });
    var publishReplay_1 = require_publishReplay();
    Object.defineProperty(exports, "publishReplay", { enumerable: true, get: function() {
      return publishReplay_1.publishReplay;
    } });
    var race_1 = require_race2();
    Object.defineProperty(exports, "race", { enumerable: true, get: function() {
      return race_1.race;
    } });
    var raceWith_1 = require_raceWith();
    Object.defineProperty(exports, "raceWith", { enumerable: true, get: function() {
      return raceWith_1.raceWith;
    } });
    var reduce_1 = require_reduce();
    Object.defineProperty(exports, "reduce", { enumerable: true, get: function() {
      return reduce_1.reduce;
    } });
    var repeat_1 = require_repeat();
    Object.defineProperty(exports, "repeat", { enumerable: true, get: function() {
      return repeat_1.repeat;
    } });
    var repeatWhen_1 = require_repeatWhen();
    Object.defineProperty(exports, "repeatWhen", { enumerable: true, get: function() {
      return repeatWhen_1.repeatWhen;
    } });
    var retry_1 = require_retry();
    Object.defineProperty(exports, "retry", { enumerable: true, get: function() {
      return retry_1.retry;
    } });
    var retryWhen_1 = require_retryWhen();
    Object.defineProperty(exports, "retryWhen", { enumerable: true, get: function() {
      return retryWhen_1.retryWhen;
    } });
    var refCount_1 = require_refCount();
    Object.defineProperty(exports, "refCount", { enumerable: true, get: function() {
      return refCount_1.refCount;
    } });
    var sample_1 = require_sample();
    Object.defineProperty(exports, "sample", { enumerable: true, get: function() {
      return sample_1.sample;
    } });
    var sampleTime_1 = require_sampleTime();
    Object.defineProperty(exports, "sampleTime", { enumerable: true, get: function() {
      return sampleTime_1.sampleTime;
    } });
    var scan_1 = require_scan();
    Object.defineProperty(exports, "scan", { enumerable: true, get: function() {
      return scan_1.scan;
    } });
    var sequenceEqual_1 = require_sequenceEqual();
    Object.defineProperty(exports, "sequenceEqual", { enumerable: true, get: function() {
      return sequenceEqual_1.sequenceEqual;
    } });
    var share_1 = require_share();
    Object.defineProperty(exports, "share", { enumerable: true, get: function() {
      return share_1.share;
    } });
    var shareReplay_1 = require_shareReplay();
    Object.defineProperty(exports, "shareReplay", { enumerable: true, get: function() {
      return shareReplay_1.shareReplay;
    } });
    var single_1 = require_single();
    Object.defineProperty(exports, "single", { enumerable: true, get: function() {
      return single_1.single;
    } });
    var skip_1 = require_skip();
    Object.defineProperty(exports, "skip", { enumerable: true, get: function() {
      return skip_1.skip;
    } });
    var skipLast_1 = require_skipLast();
    Object.defineProperty(exports, "skipLast", { enumerable: true, get: function() {
      return skipLast_1.skipLast;
    } });
    var skipUntil_1 = require_skipUntil();
    Object.defineProperty(exports, "skipUntil", { enumerable: true, get: function() {
      return skipUntil_1.skipUntil;
    } });
    var skipWhile_1 = require_skipWhile();
    Object.defineProperty(exports, "skipWhile", { enumerable: true, get: function() {
      return skipWhile_1.skipWhile;
    } });
    var startWith_1 = require_startWith();
    Object.defineProperty(exports, "startWith", { enumerable: true, get: function() {
      return startWith_1.startWith;
    } });
    var subscribeOn_1 = require_subscribeOn();
    Object.defineProperty(exports, "subscribeOn", { enumerable: true, get: function() {
      return subscribeOn_1.subscribeOn;
    } });
    var switchAll_1 = require_switchAll();
    Object.defineProperty(exports, "switchAll", { enumerable: true, get: function() {
      return switchAll_1.switchAll;
    } });
    var switchMap_1 = require_switchMap();
    Object.defineProperty(exports, "switchMap", { enumerable: true, get: function() {
      return switchMap_1.switchMap;
    } });
    var switchMapTo_1 = require_switchMapTo();
    Object.defineProperty(exports, "switchMapTo", { enumerable: true, get: function() {
      return switchMapTo_1.switchMapTo;
    } });
    var switchScan_1 = require_switchScan();
    Object.defineProperty(exports, "switchScan", { enumerable: true, get: function() {
      return switchScan_1.switchScan;
    } });
    var take_1 = require_take();
    Object.defineProperty(exports, "take", { enumerable: true, get: function() {
      return take_1.take;
    } });
    var takeLast_1 = require_takeLast();
    Object.defineProperty(exports, "takeLast", { enumerable: true, get: function() {
      return takeLast_1.takeLast;
    } });
    var takeUntil_1 = require_takeUntil();
    Object.defineProperty(exports, "takeUntil", { enumerable: true, get: function() {
      return takeUntil_1.takeUntil;
    } });
    var takeWhile_1 = require_takeWhile();
    Object.defineProperty(exports, "takeWhile", { enumerable: true, get: function() {
      return takeWhile_1.takeWhile;
    } });
    var tap_1 = require_tap();
    Object.defineProperty(exports, "tap", { enumerable: true, get: function() {
      return tap_1.tap;
    } });
    var throttle_1 = require_throttle();
    Object.defineProperty(exports, "throttle", { enumerable: true, get: function() {
      return throttle_1.throttle;
    } });
    var throttleTime_1 = require_throttleTime();
    Object.defineProperty(exports, "throttleTime", { enumerable: true, get: function() {
      return throttleTime_1.throttleTime;
    } });
    var throwIfEmpty_1 = require_throwIfEmpty();
    Object.defineProperty(exports, "throwIfEmpty", { enumerable: true, get: function() {
      return throwIfEmpty_1.throwIfEmpty;
    } });
    var timeInterval_1 = require_timeInterval();
    Object.defineProperty(exports, "timeInterval", { enumerable: true, get: function() {
      return timeInterval_1.timeInterval;
    } });
    var timeout_1 = require_timeout();
    Object.defineProperty(exports, "timeout", { enumerable: true, get: function() {
      return timeout_1.timeout;
    } });
    var timeoutWith_1 = require_timeoutWith();
    Object.defineProperty(exports, "timeoutWith", { enumerable: true, get: function() {
      return timeoutWith_1.timeoutWith;
    } });
    var timestamp_1 = require_timestamp();
    Object.defineProperty(exports, "timestamp", { enumerable: true, get: function() {
      return timestamp_1.timestamp;
    } });
    var toArray_1 = require_toArray();
    Object.defineProperty(exports, "toArray", { enumerable: true, get: function() {
      return toArray_1.toArray;
    } });
    var window_1 = require_window();
    Object.defineProperty(exports, "window", { enumerable: true, get: function() {
      return window_1.window;
    } });
    var windowCount_1 = require_windowCount();
    Object.defineProperty(exports, "windowCount", { enumerable: true, get: function() {
      return windowCount_1.windowCount;
    } });
    var windowTime_1 = require_windowTime();
    Object.defineProperty(exports, "windowTime", { enumerable: true, get: function() {
      return windowTime_1.windowTime;
    } });
    var windowToggle_1 = require_windowToggle();
    Object.defineProperty(exports, "windowToggle", { enumerable: true, get: function() {
      return windowToggle_1.windowToggle;
    } });
    var windowWhen_1 = require_windowWhen();
    Object.defineProperty(exports, "windowWhen", { enumerable: true, get: function() {
      return windowWhen_1.windowWhen;
    } });
    var withLatestFrom_1 = require_withLatestFrom();
    Object.defineProperty(exports, "withLatestFrom", { enumerable: true, get: function() {
      return withLatestFrom_1.withLatestFrom;
    } });
    var zip_1 = require_zip2();
    Object.defineProperty(exports, "zip", { enumerable: true, get: function() {
      return zip_1.zip;
    } });
    var zipAll_1 = require_zipAll();
    Object.defineProperty(exports, "zipAll", { enumerable: true, get: function() {
      return zipAll_1.zipAll;
    } });
    var zipWith_1 = require_zipWith();
    Object.defineProperty(exports, "zipWith", { enumerable: true, get: function() {
      return zipWith_1.zipWith;
    } });
  }
});

// node_modules/.pnpm/untruncate-json@0.0.1/node_modules/untruncate-json/dist/cjs/index.js
var require_cjs2 = __commonJS({
  "node_modules/.pnpm/untruncate-json@0.0.1/node_modules/untruncate-json/dist/cjs/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function isWhitespace(char) {
      return " \r\n	".indexOf(char) >= 0;
    }
    function untruncateJson(json) {
      var contextStack = [
        "topLevel"
        /* TOP_LEVEL */
      ];
      var position = 0;
      var respawnPosition;
      var respawnStackLength;
      var respawnReason;
      var push = function(context) {
        return contextStack.push(context);
      };
      var replace = function(context) {
        return contextStack[contextStack.length - 1] = context;
      };
      var setRespawn = function(reason) {
        if (respawnPosition == null) {
          respawnPosition = position;
          respawnStackLength = contextStack.length;
          respawnReason = reason;
        }
      };
      var clearRespawn = function(reason) {
        if (reason === respawnReason) {
          respawnPosition = void 0;
          respawnStackLength = void 0;
          respawnReason = void 0;
        }
      };
      var pop = function() {
        return contextStack.pop();
      };
      var dontConsumeCharacter = function() {
        return position--;
      };
      var startAny = function(char2) {
        if ("0" <= char2 && char2 <= "9") {
          push(
            "number"
            /* NUMBER */
          );
          return;
        }
        switch (char2) {
          case '"':
            push(
              "string"
              /* STRING */
            );
            return;
          case "-":
            push(
              "numberNeedsDigit"
              /* NUMBER_NEEDS_DIGIT */
            );
            return;
          case "t":
            push(
              "true"
              /* TRUE */
            );
            return;
          case "f":
            push(
              "false"
              /* FALSE */
            );
            return;
          case "n":
            push(
              "null"
              /* NULL */
            );
            return;
          case "[":
            push(
              "arrayNeedsValue"
              /* ARRAY_NEEDS_VALUE */
            );
            return;
          case "{":
            push(
              "objectNeedsKey"
              /* OBJECT_NEEDS_KEY */
            );
            return;
        }
      };
      for (var length = json.length; position < length; position++) {
        var char = json[position];
        switch (contextStack[contextStack.length - 1]) {
          case "topLevel":
            startAny(char);
            break;
          case "string":
            switch (char) {
              case '"':
                pop();
                break;
              case "\\":
                setRespawn(
                  "stringEscape"
                  /* STRING_ESCAPE */
                );
                push(
                  "stringEscaped"
                  /* STRING_ESCAPED */
                );
                break;
            }
            break;
          case "stringEscaped":
            if (char === "u") {
              push(
                "stringUnicode"
                /* STRING_UNICODE */
              );
            } else {
              clearRespawn(
                "stringEscape"
                /* STRING_ESCAPE */
              );
              pop();
            }
            break;
          case "stringUnicode":
            if (position - json.lastIndexOf("u", position) === 4) {
              clearRespawn(
                "stringEscape"
                /* STRING_ESCAPE */
              );
              pop();
            }
            break;
          case "number":
            if (char === ".") {
              replace(
                "numberNeedsDigit"
                /* NUMBER_NEEDS_DIGIT */
              );
            } else if (char === "e" || char === "E") {
              replace(
                "numberNeedsExponent"
                /* NUMBER_NEEDS_EXPONENT */
              );
            } else if (char < "0" || char > "9") {
              dontConsumeCharacter();
              pop();
            }
            break;
          case "numberNeedsDigit":
            replace(
              "number"
              /* NUMBER */
            );
            break;
          case "numberNeedsExponent":
            if (char === "+" || char === "-") {
              replace(
                "numberNeedsDigit"
                /* NUMBER_NEEDS_DIGIT */
              );
            } else {
              replace(
                "number"
                /* NUMBER */
              );
            }
            break;
          case "true":
          case "false":
          case "null":
            if (char < "a" || char > "z") {
              dontConsumeCharacter();
              pop();
            }
            break;
          case "arrayNeedsValue":
            if (char === "]") {
              pop();
            } else if (!isWhitespace(char)) {
              clearRespawn(
                "collectionItem"
                /* COLLECTION_ITEM */
              );
              replace(
                "arrayNeedsComma"
                /* ARRAY_NEEDS_COMMA */
              );
              startAny(char);
            }
            break;
          case "arrayNeedsComma":
            if (char === "]") {
              pop();
            } else if (char === ",") {
              setRespawn(
                "collectionItem"
                /* COLLECTION_ITEM */
              );
              replace(
                "arrayNeedsValue"
                /* ARRAY_NEEDS_VALUE */
              );
            }
            break;
          case "objectNeedsKey":
            if (char === "}") {
              pop();
            } else if (char === '"') {
              setRespawn(
                "collectionItem"
                /* COLLECTION_ITEM */
              );
              replace(
                "objectNeedsColon"
                /* OBJECT_NEEDS_COLON */
              );
              push(
                "string"
                /* STRING */
              );
            }
            break;
          case "objectNeedsColon":
            if (char === ":") {
              replace(
                "objectNeedsValue"
                /* OBJECT_NEEDS_VALUE */
              );
            }
            break;
          case "objectNeedsValue":
            if (!isWhitespace(char)) {
              clearRespawn(
                "collectionItem"
                /* COLLECTION_ITEM */
              );
              replace(
                "objectNeedsComma"
                /* OBJECT_NEEDS_COMMA */
              );
              startAny(char);
            }
            break;
          case "objectNeedsComma":
            if (char === "}") {
              pop();
            } else if (char === ",") {
              setRespawn(
                "collectionItem"
                /* COLLECTION_ITEM */
              );
              replace(
                "objectNeedsKey"
                /* OBJECT_NEEDS_KEY */
              );
            }
            break;
        }
      }
      if (respawnStackLength != null) {
        contextStack.length = respawnStackLength;
      }
      var result = [
        respawnPosition != null ? json.slice(0, respawnPosition) : json
      ];
      var finishWord = function(word) {
        return result.push(word.slice(json.length - json.lastIndexOf(word[0])));
      };
      for (var i = contextStack.length - 1; i >= 0; i--) {
        switch (contextStack[i]) {
          case "string":
            result.push('"');
            break;
          case "numberNeedsDigit":
          case "numberNeedsExponent":
            result.push("0");
            break;
          case "true":
            finishWord("true");
            break;
          case "false":
            finishWord("false");
            break;
          case "null":
            finishWord("null");
            break;
          case "arrayNeedsValue":
          case "arrayNeedsComma":
            result.push("]");
            break;
          case "objectNeedsKey":
          case "objectNeedsColon":
          case "objectNeedsValue":
          case "objectNeedsComma":
            result.push("}");
            break;
        }
      }
      return result.join("");
    }
    exports.default = untruncateJson;
  }
});

// node_modules/.pnpm/compare-versions@6.1.1/node_modules/compare-versions/lib/umd/index.js
var require_umd = __commonJS({
  "node_modules/.pnpm/compare-versions@6.1.1/node_modules/compare-versions/lib/umd/index.js"(exports, module) {
    (function(global, factory) {
      typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory(global.compareVersions = {}));
    })(exports, (function(exports2) {
      "use strict";
      const semver = /^[v^~<>=]*?(\d+)(?:\.([x*]|\d+)(?:\.([x*]|\d+)(?:\.([x*]|\d+))?(?:-([\da-z\-]+(?:\.[\da-z\-]+)*))?(?:\+[\da-z\-]+(?:\.[\da-z\-]+)*)?)?)?$/i;
      const validateAndParse = (version) => {
        if (typeof version !== "string") {
          throw new TypeError("Invalid argument expected string");
        }
        const match = version.match(semver);
        if (!match) {
          throw new Error(`Invalid argument not valid semver ('${version}' received)`);
        }
        match.shift();
        return match;
      };
      const isWildcard = (s2) => s2 === "*" || s2 === "x" || s2 === "X";
      const tryParse = (v2) => {
        const n = parseInt(v2, 10);
        return isNaN(n) ? v2 : n;
      };
      const forceType = (a2, b2) => typeof a2 !== typeof b2 ? [String(a2), String(b2)] : [a2, b2];
      const compareStrings = (a2, b2) => {
        if (isWildcard(a2) || isWildcard(b2))
          return 0;
        const [ap, bp] = forceType(tryParse(a2), tryParse(b2));
        if (ap > bp)
          return 1;
        if (ap < bp)
          return -1;
        return 0;
      };
      const compareSegments = (a2, b2) => {
        for (let i = 0; i < Math.max(a2.length, b2.length); i++) {
          const r = compareStrings(a2[i] || "0", b2[i] || "0");
          if (r !== 0)
            return r;
        }
        return 0;
      };
      const compareVersions = (v1, v2) => {
        const n1 = validateAndParse(v1);
        const n2 = validateAndParse(v2);
        const p1 = n1.pop();
        const p2 = n2.pop();
        const r = compareSegments(n1, n2);
        if (r !== 0)
          return r;
        if (p1 && p2) {
          return compareSegments(p1.split("."), p2.split("."));
        } else if (p1 || p2) {
          return p1 ? -1 : 1;
        }
        return 0;
      };
      const compare = (v1, v2, operator) => {
        assertValidOperator(operator);
        const res = compareVersions(v1, v2);
        return operatorResMap[operator].includes(res);
      };
      const operatorResMap = {
        ">": [1],
        ">=": [0, 1],
        "=": [0],
        "<=": [-1, 0],
        "<": [-1],
        "!=": [-1, 1]
      };
      const allowedOperators = Object.keys(operatorResMap);
      const assertValidOperator = (op) => {
        if (typeof op !== "string") {
          throw new TypeError(`Invalid operator type, expected string but got ${typeof op}`);
        }
        if (allowedOperators.indexOf(op) === -1) {
          throw new Error(`Invalid operator, expected one of ${allowedOperators.join("|")}`);
        }
      };
      const satisfies = (version, range) => {
        range = range.replace(/([><=]+)\s+/g, "$1");
        if (range.includes("||")) {
          return range.split("||").some((r4) => satisfies(version, r4));
        } else if (range.includes(" - ")) {
          const [a2, b2] = range.split(" - ", 2);
          return satisfies(version, `>=${a2} <=${b2}`);
        } else if (range.includes(" ")) {
          return range.trim().replace(/\s{2,}/g, " ").split(" ").every((r4) => satisfies(version, r4));
        }
        const m2 = range.match(/^([<>=~^]+)/);
        const op = m2 ? m2[1] : "=";
        if (op !== "^" && op !== "~")
          return compare(version, range, op);
        const [v1, v2, v3, , vp] = validateAndParse(version);
        const [r1, r2, r3, , rp] = validateAndParse(range);
        const v5 = [v1, v2, v3];
        const r = [r1, r2 !== null && r2 !== void 0 ? r2 : "x", r3 !== null && r3 !== void 0 ? r3 : "x"];
        if (rp) {
          if (!vp)
            return false;
          if (compareSegments(v5, r) !== 0)
            return false;
          if (compareSegments(vp.split("."), rp.split(".")) === -1)
            return false;
        }
        const nonZero = r.findIndex((v6) => v6 !== "0") + 1;
        const i = op === "~" ? 2 : nonZero > 1 ? nonZero : 1;
        if (compareSegments(v5.slice(0, i), r.slice(0, i)) !== 0)
          return false;
        if (compareSegments(v5.slice(i), r.slice(i)) === -1)
          return false;
        return true;
      };
      const validate = (version) => typeof version === "string" && /^[v\d]/.test(version) && semver.test(version);
      const validateStrict = (version) => typeof version === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/.test(version);
      exports2.compare = compare;
      exports2.compareVersions = compareVersions;
      exports2.satisfies = satisfies;
      exports2.validate = validate;
      exports2.validateStrict = validateStrict;
    }));
  }
});

// node_modules/.pnpm/uuid@11.1.1/node_modules/uuid/dist/esm/stringify.js
var byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

// node_modules/.pnpm/uuid@11.1.1/node_modules/uuid/dist/esm/rng.js
import { randomFillSync } from "crypto";
var rnds8Pool = new Uint8Array(256);
var poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    randomFillSync(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}

// node_modules/.pnpm/uuid@11.1.1/node_modules/uuid/dist/esm/native.js
import { randomUUID } from "crypto";
var native_default = { randomUUID };

// node_modules/.pnpm/uuid@11.1.1/node_modules/uuid/dist/esm/v4.js
function v4(options, buf, offset) {
  if (native_default.randomUUID && !buf && !options) {
    return native_default.randomUUID();
  }
  options = options || {};
  const rnds = options.random ?? options.rng?.() ?? rng();
  if (rnds.length < 16) {
    throw new Error("Random bytes length must be >= 16");
  }
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    if (offset < 0 || offset + 16 > buf.length) {
      throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
    }
    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
var v4_default = v4;

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_2) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k2) => typeof obj[obj[k2]] !== "number");
    const filtered = {};
    for (const k2 of validKeys) {
      filtered[k2] = obj[k2];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_2, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m2) => !!m2).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x2) => !!x2)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s2 of results) {
      if (s2.status === "aborted")
        return INVALID;
      if (s2.status === "dirty")
        status.dirty();
      arrayValue.push(s2.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x2) => x2.status === "aborted";
var isDirty = (x2) => x2.status === "dirty";
var isValid = (x2) => x2.status === "valid";
var isAsync = (x2) => typeof Promise !== "undefined" && x2 instanceof Promise;

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a2, b2) {
  const aType = getParsedType(a2);
  const bType = getParsedType(b2);
  if (a2 === b2) {
    return { valid: true, data: a2 };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b2);
    const sharedKeys = util.objectKeys(a2).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a2, ...b2 };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a2[key], b2[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a2.length !== b2.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a2.length; index++) {
      const itemA = a2[index];
      const itemB = b2[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a2 === +b2) {
    return { valid: true, data: a2 };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x2) => !!x2);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x2) => !!x2),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x2) => !!x2),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me2 = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me2._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me2._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me2 = this;
      return OK(function(...args) {
        const parsedArgs = me2._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me2._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = /* @__PURE__ */ Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a2, b2) {
    return new _ZodPipeline({
      in: a2,
      out: b2,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p2 = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p22 = typeof p2 === "string" ? { message: p2 } : p2;
  return p22;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// node_modules/.pnpm/@ag-ui+core@0.0.58/node_modules/@ag-ui/core/dist/index.mjs
var FunctionCallSchema = external_exports.object({
  name: external_exports.string(),
  arguments: external_exports.string()
});
var ToolCallSchema = external_exports.object({
  id: external_exports.string(),
  type: external_exports.literal("function"),
  function: FunctionCallSchema,
  encryptedValue: external_exports.string().optional()
});
var BaseMessageSchema = external_exports.object({
  id: external_exports.string(),
  role: external_exports.string(),
  content: external_exports.string().optional(),
  name: external_exports.string().optional(),
  encryptedValue: external_exports.string().optional()
});
var TextInputContentSchema = external_exports.object({
  type: external_exports.literal("text"),
  text: external_exports.string()
});
var InputContentDataSourceSchema = external_exports.object({
  type: external_exports.literal("data"),
  value: external_exports.string(),
  mimeType: external_exports.string()
});
var InputContentUrlSourceSchema = external_exports.object({
  type: external_exports.literal("url"),
  value: external_exports.string(),
  mimeType: external_exports.string().optional()
});
var InputContentSourceSchema = external_exports.discriminatedUnion("type", [InputContentDataSourceSchema, InputContentUrlSourceSchema]);
var ImageInputContentSchema = external_exports.object({
  type: external_exports.literal("image"),
  source: InputContentSourceSchema,
  metadata: external_exports.unknown().optional()
});
var AudioInputContentSchema = external_exports.object({
  type: external_exports.literal("audio"),
  source: InputContentSourceSchema,
  metadata: external_exports.unknown().optional()
});
var VideoInputContentSchema = external_exports.object({
  type: external_exports.literal("video"),
  source: InputContentSourceSchema,
  metadata: external_exports.unknown().optional()
});
var DocumentInputContentSchema = external_exports.object({
  type: external_exports.literal("document"),
  source: InputContentSourceSchema,
  metadata: external_exports.unknown().optional()
});
var LegacyBinaryInputContentObjectSchema = external_exports.object({
  type: external_exports.literal("binary"),
  mimeType: external_exports.string(),
  id: external_exports.string().optional(),
  url: external_exports.string().optional(),
  data: external_exports.string().optional(),
  filename: external_exports.string().optional()
});
var ensureBinaryPayload = (value, ctx) => {
  if (!value.id && !value.url && !value.data) ctx.addIssue({
    code: external_exports.ZodIssueCode.custom,
    message: "BinaryInputContent requires at least one of id, url, or data.",
    path: ["id"]
  });
};
var BinaryInputContentSchema = LegacyBinaryInputContentObjectSchema.superRefine((value, ctx) => {
  ensureBinaryPayload(value, ctx);
});
var InputContentBaseSchema = external_exports.discriminatedUnion("type", [
  TextInputContentSchema,
  ImageInputContentSchema,
  AudioInputContentSchema,
  VideoInputContentSchema,
  DocumentInputContentSchema,
  LegacyBinaryInputContentObjectSchema
]);
var InputContentSchema = InputContentBaseSchema.superRefine((value, ctx) => {
  if (value.type === "binary") ensureBinaryPayload(value, ctx);
});
var DeveloperMessageSchema = BaseMessageSchema.extend({
  role: external_exports.literal("developer"),
  content: external_exports.string()
});
var SystemMessageSchema = BaseMessageSchema.extend({
  role: external_exports.literal("system"),
  content: external_exports.string()
});
var AssistantMessageSchema = BaseMessageSchema.extend({
  role: external_exports.literal("assistant"),
  content: external_exports.string().optional(),
  toolCalls: external_exports.array(ToolCallSchema).optional()
});
var UserMessageSchema = BaseMessageSchema.extend({
  role: external_exports.literal("user"),
  content: external_exports.union([external_exports.string(), external_exports.array(InputContentSchema)])
});
var ToolMessageSchema = external_exports.object({
  id: external_exports.string(),
  content: external_exports.string(),
  role: external_exports.literal("tool"),
  toolCallId: external_exports.string(),
  error: external_exports.string().optional(),
  encryptedValue: external_exports.string().optional()
});
var ActivityMessageSchema = external_exports.object({
  id: external_exports.string(),
  role: external_exports.literal("activity"),
  activityType: external_exports.string(),
  content: external_exports.record(external_exports.any())
});
var ReasoningMessageSchema = external_exports.object({
  id: external_exports.string(),
  role: external_exports.literal("reasoning"),
  content: external_exports.string(),
  encryptedValue: external_exports.string().optional()
});
var MessageSchema = external_exports.discriminatedUnion("role", [
  DeveloperMessageSchema,
  SystemMessageSchema,
  AssistantMessageSchema,
  UserMessageSchema,
  ToolMessageSchema,
  ActivityMessageSchema,
  ReasoningMessageSchema
]);
var RoleSchema = external_exports.union([
  external_exports.literal("developer"),
  external_exports.literal("system"),
  external_exports.literal("assistant"),
  external_exports.literal("user"),
  external_exports.literal("tool"),
  external_exports.literal("activity"),
  external_exports.literal("reasoning")
]);
var ContextSchema = external_exports.object({
  description: external_exports.string(),
  value: external_exports.string()
});
var ToolSchema = external_exports.object({
  name: external_exports.string(),
  description: external_exports.string(),
  parameters: external_exports.any(),
  metadata: external_exports.record(external_exports.any()).optional()
});
var InterruptSchema = external_exports.object({
  id: external_exports.string(),
  reason: external_exports.string(),
  message: external_exports.string().optional(),
  toolCallId: external_exports.string().optional(),
  responseSchema: external_exports.record(external_exports.any()).optional(),
  expiresAt: external_exports.string().optional(),
  metadata: external_exports.record(external_exports.any()).optional()
});
var ResumeEntrySchema = external_exports.object({
  interruptId: external_exports.string(),
  status: external_exports.enum(["resolved", "cancelled"]),
  payload: external_exports.any().optional()
});
var RunAgentInputSchema = external_exports.object({
  threadId: external_exports.string(),
  runId: external_exports.string(),
  parentRunId: external_exports.string().optional(),
  state: external_exports.any(),
  messages: external_exports.array(MessageSchema),
  tools: external_exports.array(ToolSchema),
  context: external_exports.array(ContextSchema),
  forwardedProps: external_exports.any(),
  resume: external_exports.array(ResumeEntrySchema).optional()
});
var StateSchema = external_exports.any();
var AGUIError = class extends Error {
  constructor(message) {
    super(message);
  }
};
var AGUIConnectNotImplementedError = class extends AGUIError {
  constructor() {
    super("Connect not implemented. This method is not supported by the current agent.");
  }
};
var SubAgentInfoSchema = external_exports.object({
  name: external_exports.string(),
  description: external_exports.string().optional()
});
var IdentityCapabilitiesSchema = external_exports.object({
  name: external_exports.string().optional(),
  type: external_exports.string().optional(),
  description: external_exports.string().optional(),
  version: external_exports.string().optional(),
  provider: external_exports.string().optional(),
  documentationUrl: external_exports.string().optional(),
  metadata: external_exports.record(external_exports.unknown()).optional()
});
var TransportCapabilitiesSchema = external_exports.object({
  streaming: external_exports.boolean().optional(),
  websocket: external_exports.boolean().optional(),
  httpBinary: external_exports.boolean().optional(),
  pushNotifications: external_exports.boolean().optional(),
  resumable: external_exports.boolean().optional()
});
var ToolsCapabilitiesSchema = external_exports.object({
  supported: external_exports.boolean().optional(),
  items: external_exports.array(ToolSchema).optional(),
  parallelCalls: external_exports.boolean().optional(),
  clientProvided: external_exports.boolean().optional()
});
var OutputCapabilitiesSchema = external_exports.object({
  structuredOutput: external_exports.boolean().optional(),
  supportedMimeTypes: external_exports.array(external_exports.string()).optional()
});
var StateCapabilitiesSchema = external_exports.object({
  snapshots: external_exports.boolean().optional(),
  deltas: external_exports.boolean().optional(),
  memory: external_exports.boolean().optional(),
  persistentState: external_exports.boolean().optional()
});
var MultiAgentCapabilitiesSchema = external_exports.object({
  supported: external_exports.boolean().optional(),
  delegation: external_exports.boolean().optional(),
  handoffs: external_exports.boolean().optional(),
  subAgents: external_exports.array(SubAgentInfoSchema).optional()
});
var ReasoningCapabilitiesSchema = external_exports.object({
  supported: external_exports.boolean().optional(),
  streaming: external_exports.boolean().optional(),
  encrypted: external_exports.boolean().optional()
});
var MultimodalInputCapabilitiesSchema = external_exports.object({
  image: external_exports.boolean().optional(),
  audio: external_exports.boolean().optional(),
  video: external_exports.boolean().optional(),
  pdf: external_exports.boolean().optional(),
  file: external_exports.boolean().optional()
});
var MultimodalOutputCapabilitiesSchema = external_exports.object({
  image: external_exports.boolean().optional(),
  audio: external_exports.boolean().optional()
});
var MultimodalCapabilitiesSchema = external_exports.object({
  input: MultimodalInputCapabilitiesSchema.optional(),
  output: MultimodalOutputCapabilitiesSchema.optional()
});
var ExecutionCapabilitiesSchema = external_exports.object({
  codeExecution: external_exports.boolean().optional(),
  sandboxed: external_exports.boolean().optional(),
  maxIterations: external_exports.number().optional(),
  maxExecutionTime: external_exports.number().optional()
});
var HumanInTheLoopCapabilitiesSchema = external_exports.object({
  supported: external_exports.boolean().optional(),
  approvals: external_exports.boolean().optional(),
  interventions: external_exports.boolean().optional(),
  feedback: external_exports.boolean().optional(),
  interrupts: external_exports.boolean().optional(),
  approveWithEdits: external_exports.boolean().optional()
});
var AgentCapabilitiesSchema = external_exports.object({
  identity: IdentityCapabilitiesSchema.optional(),
  transport: TransportCapabilitiesSchema.optional(),
  tools: ToolsCapabilitiesSchema.optional(),
  output: OutputCapabilitiesSchema.optional(),
  state: StateCapabilitiesSchema.optional(),
  multiAgent: MultiAgentCapabilitiesSchema.optional(),
  reasoning: ReasoningCapabilitiesSchema.optional(),
  multimodal: MultimodalCapabilitiesSchema.optional(),
  execution: ExecutionCapabilitiesSchema.optional(),
  humanInTheLoop: HumanInTheLoopCapabilitiesSchema.optional(),
  custom: external_exports.record(external_exports.unknown()).optional()
});
var TextMessageRoleSchema = external_exports.union([
  external_exports.literal("developer"),
  external_exports.literal("system"),
  external_exports.literal("assistant"),
  external_exports.literal("user")
]);
var EventType = /* @__PURE__ */ (function(EventType2) {
  EventType2["TEXT_MESSAGE_START"] = "TEXT_MESSAGE_START";
  EventType2["TEXT_MESSAGE_CONTENT"] = "TEXT_MESSAGE_CONTENT";
  EventType2["TEXT_MESSAGE_END"] = "TEXT_MESSAGE_END";
  EventType2["TEXT_MESSAGE_CHUNK"] = "TEXT_MESSAGE_CHUNK";
  EventType2["TOOL_CALL_START"] = "TOOL_CALL_START";
  EventType2["TOOL_CALL_ARGS"] = "TOOL_CALL_ARGS";
  EventType2["TOOL_CALL_END"] = "TOOL_CALL_END";
  EventType2["TOOL_CALL_CHUNK"] = "TOOL_CALL_CHUNK";
  EventType2["TOOL_CALL_RESULT"] = "TOOL_CALL_RESULT";
  EventType2["THINKING_START"] = "THINKING_START";
  EventType2["THINKING_END"] = "THINKING_END";
  EventType2["THINKING_TEXT_MESSAGE_START"] = "THINKING_TEXT_MESSAGE_START";
  EventType2["THINKING_TEXT_MESSAGE_CONTENT"] = "THINKING_TEXT_MESSAGE_CONTENT";
  EventType2["THINKING_TEXT_MESSAGE_END"] = "THINKING_TEXT_MESSAGE_END";
  EventType2["STATE_SNAPSHOT"] = "STATE_SNAPSHOT";
  EventType2["STATE_DELTA"] = "STATE_DELTA";
  EventType2["MESSAGES_SNAPSHOT"] = "MESSAGES_SNAPSHOT";
  EventType2["ACTIVITY_SNAPSHOT"] = "ACTIVITY_SNAPSHOT";
  EventType2["ACTIVITY_DELTA"] = "ACTIVITY_DELTA";
  EventType2["RAW"] = "RAW";
  EventType2["CUSTOM"] = "CUSTOM";
  EventType2["RUN_STARTED"] = "RUN_STARTED";
  EventType2["RUN_FINISHED"] = "RUN_FINISHED";
  EventType2["RUN_ERROR"] = "RUN_ERROR";
  EventType2["STEP_STARTED"] = "STEP_STARTED";
  EventType2["STEP_FINISHED"] = "STEP_FINISHED";
  EventType2["REASONING_START"] = "REASONING_START";
  EventType2["REASONING_MESSAGE_START"] = "REASONING_MESSAGE_START";
  EventType2["REASONING_MESSAGE_CONTENT"] = "REASONING_MESSAGE_CONTENT";
  EventType2["REASONING_MESSAGE_END"] = "REASONING_MESSAGE_END";
  EventType2["REASONING_MESSAGE_CHUNK"] = "REASONING_MESSAGE_CHUNK";
  EventType2["REASONING_END"] = "REASONING_END";
  EventType2["REASONING_ENCRYPTED_VALUE"] = "REASONING_ENCRYPTED_VALUE";
  return EventType2;
})({});
var BaseEventSchema = external_exports.object({
  type: external_exports.nativeEnum(EventType),
  timestamp: external_exports.number().optional(),
  rawEvent: external_exports.any().optional()
}).passthrough();
var TextMessageStartEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.TEXT_MESSAGE_START),
  messageId: external_exports.string(),
  role: TextMessageRoleSchema.default("assistant"),
  name: external_exports.string().optional()
});
var TextMessageContentEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.TEXT_MESSAGE_CONTENT),
  messageId: external_exports.string(),
  delta: external_exports.string()
});
var TextMessageEndEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.TEXT_MESSAGE_END),
  messageId: external_exports.string()
});
var TextMessageChunkEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.TEXT_MESSAGE_CHUNK),
  messageId: external_exports.string().optional(),
  role: TextMessageRoleSchema.optional(),
  delta: external_exports.string().optional(),
  name: external_exports.string().optional()
});
var ThinkingTextMessageStartEventSchema = BaseEventSchema.extend({ type: external_exports.literal(EventType.THINKING_TEXT_MESSAGE_START) });
var ThinkingTextMessageContentEventSchema = TextMessageContentEventSchema.omit({
  messageId: true,
  type: true
}).extend({ type: external_exports.literal(EventType.THINKING_TEXT_MESSAGE_CONTENT) });
var ThinkingTextMessageEndEventSchema = BaseEventSchema.extend({ type: external_exports.literal(EventType.THINKING_TEXT_MESSAGE_END) });
var ToolCallStartEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.TOOL_CALL_START),
  toolCallId: external_exports.string(),
  toolCallName: external_exports.string(),
  parentMessageId: external_exports.string().nullable().optional().transform((v2) => v2 ?? void 0)
});
var ToolCallArgsEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.TOOL_CALL_ARGS),
  toolCallId: external_exports.string(),
  delta: external_exports.string()
});
var ToolCallEndEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.TOOL_CALL_END),
  toolCallId: external_exports.string()
});
var ToolCallResultEventSchema = BaseEventSchema.extend({
  messageId: external_exports.string(),
  type: external_exports.literal(EventType.TOOL_CALL_RESULT),
  toolCallId: external_exports.string(),
  content: external_exports.string(),
  role: external_exports.literal("tool").optional()
});
var ToolCallChunkEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.TOOL_CALL_CHUNK),
  toolCallId: external_exports.string().optional(),
  toolCallName: external_exports.string().optional(),
  parentMessageId: external_exports.string().nullable().optional().transform((v2) => v2 ?? void 0),
  delta: external_exports.string().optional()
});
var ThinkingStartEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.THINKING_START),
  title: external_exports.string().optional()
});
var ThinkingEndEventSchema = BaseEventSchema.extend({ type: external_exports.literal(EventType.THINKING_END) });
var StateSnapshotEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.STATE_SNAPSHOT),
  snapshot: StateSchema
});
var StateDeltaEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.STATE_DELTA),
  delta: external_exports.array(external_exports.any())
});
var MessagesSnapshotEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.MESSAGES_SNAPSHOT),
  messages: external_exports.array(MessageSchema)
});
var ActivitySnapshotEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.ACTIVITY_SNAPSHOT),
  messageId: external_exports.string(),
  activityType: external_exports.string(),
  content: external_exports.record(external_exports.any()),
  replace: external_exports.boolean().optional().default(true)
});
var ActivityDeltaEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.ACTIVITY_DELTA),
  messageId: external_exports.string(),
  activityType: external_exports.string(),
  patch: external_exports.array(external_exports.any())
});
var RawEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.RAW),
  event: external_exports.any(),
  source: external_exports.string().optional()
});
var CustomEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.CUSTOM),
  name: external_exports.string(),
  value: external_exports.any()
});
var RunStartedEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.RUN_STARTED),
  threadId: external_exports.string(),
  runId: external_exports.string(),
  parentRunId: external_exports.string().optional(),
  input: RunAgentInputSchema.optional()
});
var RunFinishedSuccessOutcomeSchema = external_exports.object({ type: external_exports.literal("success") }).strict();
var RunFinishedInterruptOutcomeSchema = external_exports.object({
  type: external_exports.literal("interrupt"),
  interrupts: external_exports.array(InterruptSchema).min(1)
}).strict();
var RunFinishedOutcomeSchema = external_exports.discriminatedUnion("type", [RunFinishedSuccessOutcomeSchema, RunFinishedInterruptOutcomeSchema]);
var TokenUsageSchema = external_exports.object({
  provider: external_exports.string().optional(),
  model: external_exports.string().optional(),
  inputTokens: external_exports.number().int().nonnegative().optional(),
  outputTokens: external_exports.number().int().nonnegative().optional(),
  totalTokens: external_exports.number().int().nonnegative().optional(),
  reasoningTokens: external_exports.number().int().nonnegative().optional(),
  cachedInputTokens: external_exports.number().int().nonnegative().optional()
});
var RunFinishedEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.RUN_FINISHED),
  threadId: external_exports.string(),
  runId: external_exports.string(),
  result: external_exports.any().optional(),
  outcome: RunFinishedOutcomeSchema.nullable().optional().transform((v2) => v2 ?? void 0),
  usage: external_exports.array(TokenUsageSchema).optional()
});
var RunErrorEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.RUN_ERROR),
  message: external_exports.string(),
  code: external_exports.string().optional(),
  usage: external_exports.array(TokenUsageSchema).optional()
});
var StepStartedEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.STEP_STARTED),
  stepName: external_exports.string()
});
var StepFinishedEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.STEP_FINISHED),
  stepName: external_exports.string()
});
var ReasoningEncryptedValueSubtypeSchema = external_exports.union([external_exports.literal("tool-call"), external_exports.literal("message")]);
var ReasoningStartEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.REASONING_START),
  messageId: external_exports.string()
});
var ReasoningMessageStartEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.REASONING_MESSAGE_START),
  messageId: external_exports.string(),
  role: external_exports.literal("reasoning")
});
var ReasoningMessageContentEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.REASONING_MESSAGE_CONTENT),
  messageId: external_exports.string(),
  delta: external_exports.string()
});
var ReasoningMessageEndEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.REASONING_MESSAGE_END),
  messageId: external_exports.string()
});
var ReasoningMessageChunkEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.REASONING_MESSAGE_CHUNK),
  messageId: external_exports.string().optional(),
  delta: external_exports.string().optional()
});
var ReasoningEndEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.REASONING_END),
  messageId: external_exports.string()
});
var ReasoningEncryptedValueEventSchema = BaseEventSchema.extend({
  type: external_exports.literal(EventType.REASONING_ENCRYPTED_VALUE),
  subtype: ReasoningEncryptedValueSubtypeSchema,
  entityId: external_exports.string(),
  encryptedValue: external_exports.string()
});
var EventSchemas = external_exports.discriminatedUnion("type", [
  TextMessageStartEventSchema,
  TextMessageContentEventSchema,
  TextMessageEndEventSchema,
  TextMessageChunkEventSchema,
  ThinkingStartEventSchema,
  ThinkingEndEventSchema,
  ThinkingTextMessageStartEventSchema,
  ThinkingTextMessageContentEventSchema,
  ThinkingTextMessageEndEventSchema,
  ToolCallStartEventSchema,
  ToolCallArgsEventSchema,
  ToolCallEndEventSchema,
  ToolCallChunkEventSchema,
  ToolCallResultEventSchema,
  StateSnapshotEventSchema,
  StateDeltaEventSchema,
  MessagesSnapshotEventSchema,
  ActivitySnapshotEventSchema,
  ActivityDeltaEventSchema,
  RawEventSchema,
  CustomEventSchema,
  RunStartedEventSchema,
  RunFinishedEventSchema,
  RunErrorEventSchema,
  StepStartedEventSchema,
  StepFinishedEventSchema,
  ReasoningStartEventSchema,
  ReasoningMessageStartEventSchema,
  ReasoningMessageContentEventSchema,
  ReasoningMessageEndEventSchema,
  ReasoningMessageChunkEventSchema,
  ReasoningEndEventSchema,
  ReasoningEncryptedValueEventSchema
]);

// node_modules/.pnpm/@ag-ui+client@0.0.58/node_modules/@ag-ui/client/dist/index.mjs
var import_fast_json_patch = __toESM(require_fast_json_patch(), 1);
var import_rxjs = __toESM(require_cjs(), 1);
var import_operators = __toESM(require_operators(), 1);
var import_untruncate_json = __toESM(require_cjs2(), 1);

// node_modules/.pnpm/@bufbuild+protobuf@2.14.0/node_modules/@bufbuild/protobuf/dist/esm/wire/varint.js
function varint64read() {
  const buf = this.buf;
  let pos = this.pos;
  let lo = 0;
  let hi = 0;
  for (let shift = 0; shift < 28; shift += 7) {
    const b2 = buf[pos++];
    lo |= (b2 & 127) << shift;
    if ((b2 & 128) == 0) {
      this.pos = pos;
      this.assertBounds();
      this.varint64Lo = lo;
      this.varint64Hi = hi;
      return;
    }
  }
  const middleByte = buf[pos++];
  lo |= (middleByte & 15) << 28;
  hi = (middleByte & 112) >> 4;
  if ((middleByte & 128) == 0) {
    this.pos = pos;
    this.assertBounds();
    this.varint64Lo = lo;
    this.varint64Hi = hi;
    return;
  }
  for (let shift = 3; shift <= 31; shift += 7) {
    const b2 = buf[pos++];
    hi |= (b2 & 127) << shift;
    if ((b2 & 128) == 0) {
      this.pos = pos;
      this.assertBounds();
      this.varint64Lo = lo;
      this.varint64Hi = hi;
      return;
    }
  }
  throw new Error("invalid varint");
}
var TWO_PWR_32_DBL = 4294967296;
function int64FromString(dec) {
  const minus = dec[0] === "-";
  if (minus) {
    dec = dec.slice(1);
  }
  const base = 1e6;
  let lowBits = 0;
  let highBits = 0;
  function add1e6digit(begin, end) {
    const digit1e6 = Number(dec.slice(begin, end));
    highBits *= base;
    lowBits = lowBits * base + digit1e6;
    if (lowBits >= TWO_PWR_32_DBL) {
      highBits = highBits + (lowBits / TWO_PWR_32_DBL | 0);
      lowBits = lowBits % TWO_PWR_32_DBL;
    }
  }
  add1e6digit(-24, -18);
  add1e6digit(-18, -12);
  add1e6digit(-12, -6);
  add1e6digit(-6);
  return minus ? negate(lowBits, highBits) : newBits(lowBits, highBits);
}
function int64ToString(lo, hi) {
  let bits = newBits(lo, hi);
  const negative = bits.hi & 2147483648;
  if (negative) {
    bits = negate(bits.lo, bits.hi);
  }
  const result = uInt64ToString(bits.lo, bits.hi);
  return negative ? "-" + result : result;
}
function uInt64ToString(lo, hi) {
  ({ lo, hi } = toUnsigned(lo, hi));
  if (hi <= 2097151) {
    return String(TWO_PWR_32_DBL * hi + lo);
  }
  const low = lo & 16777215;
  const mid = (lo >>> 24 | hi << 8) & 16777215;
  const high = hi >> 16 & 65535;
  let digitA = low + mid * 6777216 + high * 6710656;
  let digitB = mid + high * 8147497;
  let digitC = high * 2;
  const base = 1e7;
  if (digitA >= base) {
    digitB += Math.floor(digitA / base);
    digitA %= base;
  }
  if (digitB >= base) {
    digitC += Math.floor(digitB / base);
    digitB %= base;
  }
  return digitC.toString() + decimalFrom1e7WithLeadingZeros(digitB) + decimalFrom1e7WithLeadingZeros(digitA);
}
function toUnsigned(lo, hi) {
  return { lo: lo >>> 0, hi: hi >>> 0 };
}
function newBits(lo, hi) {
  return { lo: lo | 0, hi: hi | 0 };
}
function negate(lowBits, highBits) {
  highBits = ~highBits;
  if (lowBits) {
    lowBits = ~lowBits + 1;
  } else {
    highBits += 1;
  }
  return newBits(lowBits, highBits);
}
var decimalFrom1e7WithLeadingZeros = (digit1e7) => {
  const partial = String(digit1e7);
  return "0000000".slice(partial.length) + partial;
};
function varint32read() {
  let b2 = this.buf[this.pos++];
  if ((b2 & 128) === 0) {
    this.assertBounds();
    return b2;
  }
  let result = b2 & 127;
  b2 = this.buf[this.pos++];
  result |= (b2 & 127) << 7;
  if ((b2 & 128) === 0) {
    this.assertBounds();
    return result;
  }
  b2 = this.buf[this.pos++];
  result |= (b2 & 127) << 14;
  if ((b2 & 128) === 0) {
    this.assertBounds();
    return result;
  }
  b2 = this.buf[this.pos++];
  result |= (b2 & 127) << 21;
  if ((b2 & 128) === 0) {
    this.assertBounds();
    return result;
  }
  b2 = this.buf[this.pos++];
  result |= (b2 & 15) << 28;
  for (let readBytes = 5; (b2 & 128) !== 0 && readBytes < 10; readBytes++)
    b2 = this.buf[this.pos++];
  if ((b2 & 128) !== 0)
    throw new Error("invalid varint");
  this.assertBounds();
  return result >>> 0;
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.0/node_modules/@bufbuild/protobuf/dist/esm/proto-int64.js
var protoInt64 = /* @__PURE__ */ makeInt64Support();
function makeInt64Support() {
  const dv = new DataView(new ArrayBuffer(8));
  const ok = typeof BigInt === "function" && typeof dv.getBigInt64 === "function" && typeof dv.getBigUint64 === "function" && typeof dv.setBigInt64 === "function" && typeof dv.setBigUint64 === "function" && (!!globalThis.Deno || !!globalThis.Bun || typeof process != "object" || typeof process.env != "object" || process.env.BUF_BIGINT_DISABLE !== "1");
  if (ok) {
    const MIN = BigInt("-9223372036854775808");
    const MAX = BigInt("9223372036854775807");
    const UMIN = BigInt("0");
    const UMAX = BigInt("18446744073709551615");
    return {
      zero: BigInt(0),
      supported: true,
      parse(value) {
        const bi = typeof value == "bigint" ? value : BigInt(value);
        if (bi > MAX || bi < MIN) {
          throw new Error(`invalid int64: ${value}`);
        }
        return bi;
      },
      uParse(value) {
        const bi = typeof value == "bigint" ? value : BigInt(value);
        if (bi > UMAX || bi < UMIN) {
          throw new Error(`invalid uint64: ${value}`);
        }
        return bi;
      },
      enc(value) {
        dv.setBigInt64(0, this.parse(value), true);
        return {
          lo: dv.getInt32(0, true),
          hi: dv.getInt32(4, true)
        };
      },
      uEnc(value) {
        dv.setBigInt64(0, this.uParse(value), true);
        return {
          lo: dv.getInt32(0, true),
          hi: dv.getInt32(4, true)
        };
      },
      dec(lo, hi) {
        dv.setInt32(0, lo, true);
        dv.setInt32(4, hi, true);
        return dv.getBigInt64(0, true);
      },
      uDec(lo, hi) {
        dv.setInt32(0, lo, true);
        dv.setInt32(4, hi, true);
        return dv.getBigUint64(0, true);
      }
    };
  }
  return {
    zero: "0",
    supported: false,
    parse(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertInt64String(value);
      return value;
    },
    uParse(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertUInt64String(value);
      return value;
    },
    enc(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertInt64String(value);
      return int64FromString(value);
    },
    uEnc(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertUInt64String(value);
      return int64FromString(value);
    },
    dec(lo, hi) {
      return int64ToString(lo, hi);
    },
    uDec(lo, hi) {
      return uInt64ToString(lo, hi);
    }
  };
}
function assertInt64String(value) {
  if (!/^-?[0-9]+$/.test(value)) {
    throw new Error("invalid int64: " + value);
  }
}
function assertUInt64String(value) {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error("invalid uint64: " + value);
  }
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.0/node_modules/@bufbuild/protobuf/dist/esm/wire/text-encoding.js
var symbol = /* @__PURE__ */ Symbol.for("@bufbuild/protobuf/text-encoding");
function configureTextEncoding(textEncoding) {
  var _a;
  globalThis[symbol] = Object.assign(Object.assign({}, textEncoding), { encodeUtf8Into: (_a = textEncoding.encodeUtf8Into) !== null && _a !== void 0 ? _a : emulateEncodeInto(textEncoding.encodeUtf8.bind(textEncoding)) });
}
function getTextEncoding() {
  const globals = globalThis;
  if (!globals[symbol]) {
    const textEncoder = new globals.TextEncoder();
    const textDecoder = new globals.TextDecoder();
    let textDecoderStrict;
    const config = {
      encodeUtf8(text) {
        return textEncoder.encode(text);
      },
      decodeUtf8(bytes, strict) {
        if (strict) {
          if (!textDecoderStrict) {
            textDecoderStrict = new globals.TextDecoder("utf-8", {
              fatal: true
            });
          }
          return textDecoderStrict.decode(bytes);
        }
        return textDecoder.decode(bytes);
      },
      checkUtf8(text) {
        try {
          encodeURIComponent(text);
          return true;
        } catch (_2) {
          return false;
        }
      }
    };
    if (textEncoder.encodeInto) {
      config.encodeUtf8Into = textEncoder.encodeInto.bind(textEncoder);
    }
    const nativeStringIsWellFormed = String.prototype.isWellFormed;
    if (nativeStringIsWellFormed) {
      config.checkUtf8 = (text) => {
        return nativeStringIsWellFormed.call(text);
      };
    }
    configureTextEncoding(config);
  }
  return globals[symbol];
}
function emulateEncodeInto(encodeUtf8) {
  return (text, dest) => {
    const bytes = encodeUtf8(text);
    dest.set(bytes);
    return { written: bytes.byteLength };
  };
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.0/node_modules/@bufbuild/protobuf/dist/esm/wire/binary-encoding.js
var WireType;
(function(WireType2) {
  WireType2[WireType2["Varint"] = 0] = "Varint";
  WireType2[WireType2["Bit64"] = 1] = "Bit64";
  WireType2[WireType2["LengthDelimited"] = 2] = "LengthDelimited";
  WireType2[WireType2["StartGroup"] = 3] = "StartGroup";
  WireType2[WireType2["EndGroup"] = 4] = "EndGroup";
  WireType2[WireType2["Bit32"] = 5] = "Bit32";
})(WireType || (WireType = {}));
var FLOAT32_MAX = 34028234663852886e22;
var FLOAT32_MIN = -34028234663852886e22;
var UINT32_MAX = 4294967295;
var INT32_MAX = 2147483647;
var INT32_MIN = -2147483648;
var BinaryWriter = class {
  constructor(encodeUtf8) {
    this.stackPos = [];
    this.encodeUtf8Into = encodeUtf8 ? emulateEncodeInto(encodeUtf8) : getTextEncoding().encodeUtf8Into;
    this.buffer = EMPTY_BUFFER;
    this.viewCache = EMPTY_VIEW;
    this.pos = 0;
  }
  ensureCapacity(size) {
    const required = this.pos + size;
    if (required > this.buffer.length) {
      let newLen = this.buffer.length || INITIAL_SIZE;
      while (newLen < required)
        newLen *= 2;
      const newBuf = new Uint8Array(newLen);
      if (this.pos > 0)
        newBuf.set(this.buffer);
      this.buffer = newBuf;
    }
  }
  /**
   * The DataView over `buffer`, rebuilt only if the buffer has grown since it
   * was last used.
   */
  view() {
    const bytes = this.buffer;
    const view = this.viewCache;
    if (view.byteLength === bytes.byteLength)
      return view;
    const newView = new DataView(bytes.buffer);
    this.viewCache = newView;
    return newView;
  }
  /**
   * Return all bytes written and reset this writer.
   */
  finish() {
    const result = this.buffer.slice(0, this.pos);
    this.pos = 0;
    this.stackPos = [];
    return result;
  }
  /**
   * Start a new fork for length-delimited data like a message
   * or a packed repeated field.
   *
   * Must be joined later with `join()`.
   */
  fork() {
    this.stackPos.push(this.pos);
    this.ensureCapacity(DEFAULT_LEN_PREFIX_SIZE);
    this.buffer[this.pos++] = 0;
    return this;
  }
  /**
   * Join the last fork. Write its length and bytes, then
   * return to the previous state.
   */
  join() {
    const forkPos = this.stackPos.pop();
    if (forkPos === void 0)
      throw new Error("invalid state, fork stack empty");
    const len = this.pos - forkPos - DEFAULT_LEN_PREFIX_SIZE;
    const lenPrefixSize = varint32Size(len);
    if (lenPrefixSize > DEFAULT_LEN_PREFIX_SIZE) {
      this.ensureCapacity(lenPrefixSize - DEFAULT_LEN_PREFIX_SIZE);
      this.buffer.copyWithin(forkPos + lenPrefixSize, forkPos + DEFAULT_LEN_PREFIX_SIZE, this.pos);
    }
    this.pos = forkPos;
    this.uint32(len);
    this.pos += len;
    return this;
  }
  /**
   * Writes a tag (field number and wire type).
   *
   * Equivalent to `uint32( (fieldNo << 3 | type) >>> 0 )`.
   *
   * Generated code should compute the tag ahead of time and call `uint32()`.
   */
  tag(fieldNo, type) {
    return this.uint32((fieldNo << 3 | type) >>> 0);
  }
  /**
   * Write a chunk of raw bytes.
   */
  raw(chunk) {
    this.ensureCapacity(chunk.length);
    this.buffer.set(chunk, this.pos);
    this.pos += chunk.length;
    return this;
  }
  /**
   * Write a `uint32` value, an unsigned 32 bit varint.
   */
  uint32(value) {
    assertUInt32(value);
    this.ensureCapacity(5);
    if (value < 128) {
      this.buffer[this.pos++] = value;
      return this;
    }
    while (value > 127) {
      this.buffer[this.pos++] = value & 127 | 128;
      value >>>= 7;
    }
    this.buffer[this.pos++] = value;
    return this;
  }
  /**
   * Write a `int32` value, a signed 32 bit varint.
   */
  int32(value) {
    assertInt32(value);
    if (value >= 0) {
      return this.uint32(value);
    }
    this.ensureCapacity(10);
    for (let i = 0; i < 9; i++) {
      this.buffer[this.pos++] = value & 127 | 128;
      value >>= 7;
    }
    this.buffer[this.pos++] = 1;
    return this;
  }
  /**
   * Write a `bool` value, a varint.
   */
  bool(value) {
    this.ensureCapacity(1);
    this.buffer[this.pos++] = value ? 1 : 0;
    return this;
  }
  /**
   * Write a `bytes` value, length-delimited arbitrary data.
   */
  bytes(value) {
    this.uint32(value.byteLength);
    return this.raw(value);
  }
  /**
   * Write a `string` value, length-delimited data converted to UTF-8 text.
   */
  string(value) {
    if (typeof value !== "string") {
      value = String(value);
    }
    const len = value.length;
    if (len <= ASCII_MAX_LENGTH) {
      this.ensureCapacity(len + 1);
      const ascii = this.buffer;
      let pos = this.pos;
      ascii[pos++] = len;
      let i = 0;
      for (; i < len; i++) {
        const code = value.charCodeAt(i);
        if (code > 127)
          break;
        ascii[pos++] = code;
      }
      if (i == len) {
        this.pos = pos;
        return this;
      }
    }
    this.ensureCapacity(len * 3 + 5);
    const lenPrefixSizeGuess = varint32Size(len);
    const buf = this.buffer;
    const start = this.pos;
    const { written } = this.encodeUtf8Into(value, buf.subarray(start + lenPrefixSizeGuess));
    const lenPrefixSize = varint32Size(written);
    if (lenPrefixSize != lenPrefixSizeGuess) {
      buf.copyWithin(start + lenPrefixSize, start + lenPrefixSizeGuess, start + lenPrefixSizeGuess + written);
    }
    this.uint32(written);
    this.pos += written;
    return this;
  }
  /**
   * Write a `float` value, 32-bit floating point number.
   */
  float(value) {
    assertFloat32(value);
    this.ensureCapacity(4);
    this.view().setFloat32(this.pos, value, true);
    this.pos += 4;
    return this;
  }
  /**
   * Write a `double` value, a 64-bit floating point number.
   */
  double(value) {
    this.ensureCapacity(8);
    this.view().setFloat64(this.pos, value, true);
    this.pos += 8;
    return this;
  }
  /**
   * Write a `fixed32` value, an unsigned, fixed-length 32-bit integer.
   */
  fixed32(value) {
    assertUInt32(value);
    this.ensureCapacity(4);
    this.view().setUint32(this.pos, value, true);
    this.pos += 4;
    return this;
  }
  /**
   * Write a `sfixed32` value, a signed, fixed-length 32-bit integer.
   */
  sfixed32(value) {
    assertInt32(value);
    this.ensureCapacity(4);
    this.view().setInt32(this.pos, value, true);
    this.pos += 4;
    return this;
  }
  /**
   * Write a `sint32` value, a signed, zigzag-encoded 32-bit varint.
   */
  sint32(value) {
    assertInt32(value);
    return this.uint32((value << 1 ^ value >> 31) >>> 0);
  }
  /**
   * Write a `sfixed64` value, a signed, fixed-length 64-bit integer.
   */
  sfixed64(value) {
    const tc = protoInt64.enc(value);
    this.ensureCapacity(8);
    const view = this.view();
    view.setInt32(this.pos, tc.lo, true);
    view.setInt32(this.pos + 4, tc.hi, true);
    this.pos += 8;
    return this;
  }
  /**
   * Write a `fixed64` value, an unsigned, fixed-length 64 bit integer.
   */
  fixed64(value) {
    const tc = protoInt64.uEnc(value);
    this.ensureCapacity(8);
    const view = this.view();
    view.setInt32(this.pos, tc.lo, true);
    view.setInt32(this.pos + 4, tc.hi, true);
    this.pos += 8;
    return this;
  }
  /**
   * Write a `int64` value, a signed 64-bit varint.
   */
  int64(value) {
    const tc = protoInt64.enc(value);
    return this.writeVarint64(tc.lo, tc.hi);
  }
  /**
   * Write a `sint64` value, a signed, zig-zag-encoded 64-bit varint.
   */
  sint64(value) {
    const tc = protoInt64.enc(value), sign = tc.hi >> 31, lo = tc.lo << 1 ^ sign, hi = (tc.hi << 1 | tc.lo >>> 31) ^ sign;
    return this.writeVarint64(lo, hi);
  }
  /**
   * Write a `uint64` value, an unsigned 64-bit varint.
   */
  uint64(value) {
    const tc = protoInt64.uEnc(value);
    return this.writeVarint64(tc.lo, tc.hi);
  }
  /**
   * Write a 64-bit varint directly into the buffer. Accepts the value as
   * split low/high 32-bit words.
   *
   * Ported from varint64write() to avoid the intermediate number[] buffer.
   * See https://github.com/protocolbuffers/protobuf/blob/8a71927d74a4ce34efe2d8769fda198f52d20d12/js/experimental/runtime/kernel/writer.js#L344
   */
  writeVarint64(lo, hi) {
    this.ensureCapacity(10);
    const buf = this.buffer;
    let pos = this.pos;
    for (let i = 0; i < 28; i = i + 7) {
      const shift = lo >>> i;
      const hasNext = !(shift >>> 7 == 0 && hi == 0);
      buf[pos++] = (hasNext ? shift | 128 : shift) & 255;
      if (!hasNext) {
        this.pos = pos;
        return this;
      }
    }
    const splitBits = lo >>> 28 & 15 | (hi & 7) << 4;
    const hasMoreBits = !(hi >> 3 == 0);
    buf[pos++] = (hasMoreBits ? splitBits | 128 : splitBits) & 255;
    if (!hasMoreBits) {
      this.pos = pos;
      return this;
    }
    for (let i = 3; i < 31; i = i + 7) {
      const shift = hi >>> i;
      const hasNext = !(shift >>> 7 == 0);
      buf[pos++] = (hasNext ? shift | 128 : shift) & 255;
      if (!hasNext) {
        this.pos = pos;
        return this;
      }
    }
    buf[pos++] = hi >>> 31 & 1;
    this.pos = pos;
    return this;
  }
};
var INITIAL_SIZE = 128;
var DEFAULT_LEN_PREFIX_SIZE = 1;
var EMPTY_BUFFER = new Uint8Array(0);
var EMPTY_VIEW = new DataView(EMPTY_BUFFER.buffer);
var ASCII_MAX_LENGTH = 32;
function varint32Size(value) {
  if (value < 128)
    return 1;
  if (value < 16384)
    return 2;
  if (value < 2097152)
    return 3;
  if (value < 268435456)
    return 4;
  return 5;
}
var BinaryReader = class {
  constructor(buf, decodeUtf8 = getTextEncoding().decodeUtf8) {
    this.decodeUtf8 = decodeUtf8;
    this.varint64Lo = 0;
    this.varint64Hi = 0;
    this.varint64 = varint64read;
    this.uint32 = varint32read;
    this.buf = buf;
    this.len = buf.length;
    this.pos = 0;
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  /**
   * Reads a tag - field number and wire type. Tags are uint32 varints; values
   * that do not fit in uint32 are rejected.
   */
  tag() {
    const start = this.pos;
    const tag = this.uint32();
    const bytesRead = this.pos - start;
    if (bytesRead > 5 || bytesRead == 5 && this.buf[this.pos - 1] > 15) {
      throw new Error("illegal tag: varint overflows uint32");
    }
    const fieldNo = tag >>> 3;
    const wireType = tag & 7;
    if (fieldNo <= 0 || wireType > 5) {
      throw new Error("illegal tag: field no " + fieldNo + " wire type " + wireType);
    }
    return [fieldNo, wireType];
  }
  /**
   * Skip one element and return the skipped data.
   *
   * When skipping StartGroup, provide the tags field number to check for
   * matching field number in the EndGroup tag. Recursion into nested groups
   * is guarded by the `recursionLimit` argument: When the limit is reached,
   * this method throws.
   */
  skip(wireType, fieldNo, recursionLimit = 100) {
    let start = this.pos;
    switch (wireType) {
      case WireType.Varint:
        while (this.buf[this.pos++] & 128) {
        }
        break;
      // @ts-ignore TS7029: Fallthrough case in switch -- ignore instead of expect-error for compiler settings without noFallthroughCasesInSwitch: true
      case WireType.Bit64:
        this.pos += 4;
      case WireType.Bit32:
        this.pos += 4;
        break;
      case WireType.LengthDelimited:
        let len = this.uint32();
        this.pos += len;
        break;
      case WireType.StartGroup:
        if (recursionLimit <= 0) {
          throw new Error("maximum recursion depth reached");
        }
        for (; ; ) {
          const [fn, wt] = this.tag();
          if (wt === WireType.EndGroup) {
            if (fieldNo !== void 0 && fn !== fieldNo) {
              throw new Error("invalid end group tag");
            }
            break;
          }
          this.skip(wt, fn, recursionLimit - 1);
        }
        break;
      default:
        throw new Error("cant skip wire type " + wireType);
    }
    this.assertBounds();
    return this.buf.subarray(start, this.pos);
  }
  /**
   * Throws error if position in byte array is out of range.
   */
  assertBounds() {
    if (this.pos > this.len)
      throw new RangeError("premature EOF");
  }
  /**
   * Read a `int32` field, a signed 32 bit varint.
   */
  int32() {
    return this.uint32() | 0;
  }
  /**
   * Read a `sint32` field, a signed, zigzag-encoded 32-bit varint.
   */
  sint32() {
    let zze = this.uint32();
    return zze >>> 1 ^ -(zze & 1);
  }
  /**
   * Read a `int64` field, a signed 64-bit varint.
   */
  int64() {
    this.varint64();
    return protoInt64.dec(this.varint64Lo, this.varint64Hi);
  }
  /**
   * Read a `uint64` field, an unsigned 64-bit varint.
   */
  uint64() {
    this.varint64();
    return protoInt64.uDec(this.varint64Lo, this.varint64Hi);
  }
  /**
   * Read a `sint64` field, a signed, zig-zag-encoded 64-bit varint.
   */
  sint64() {
    this.varint64();
    let lo = this.varint64Lo;
    let hi = this.varint64Hi;
    let s2 = -(lo & 1);
    lo = (lo >>> 1 | (hi & 1) << 31) ^ s2;
    hi = hi >>> 1 ^ s2;
    return protoInt64.dec(lo, hi);
  }
  /**
   * Read a `bool` field, a variant.
   */
  bool() {
    const b2 = this.buf[this.pos];
    if (b2 < 128) {
      this.pos++;
      return b2 !== 0;
    }
    this.varint64();
    return this.varint64Lo !== 0 || this.varint64Hi !== 0;
  }
  /**
   * Read a `fixed32` field, an unsigned, fixed-length 32-bit integer.
   */
  fixed32() {
    return this.view.getUint32((this.pos += 4) - 4, true);
  }
  /**
   * Read a `sfixed32` field, a signed, fixed-length 32-bit integer.
   */
  sfixed32() {
    return this.view.getInt32((this.pos += 4) - 4, true);
  }
  /**
   * Read a `fixed64` field, an unsigned, fixed-length 64 bit integer.
   */
  fixed64() {
    return protoInt64.uDec(this.sfixed32(), this.sfixed32());
  }
  /**
   * Read a `fixed64` field, a signed, fixed-length 64-bit integer.
   */
  sfixed64() {
    return protoInt64.dec(this.sfixed32(), this.sfixed32());
  }
  /**
   * Read a `float` field, 32-bit floating point number.
   */
  float() {
    return this.view.getFloat32((this.pos += 4) - 4, true);
  }
  /**
   * Read a `double` field, a 64-bit floating point number.
   */
  double() {
    return this.view.getFloat64((this.pos += 8) - 8, true);
  }
  /**
   * Read a `bytes` field, length-delimited arbitrary data.
   */
  bytes() {
    let len = this.uint32(), start = this.pos;
    this.pos += len;
    this.assertBounds();
    return this.buf.subarray(start, start + len);
  }
  /**
   * Read a `string` field, length-delimited data converted to UTF-8 text. If
   * `strict` is true, throw on invalid UTF-8 instead of substituting U+FFFD.
   */
  string(strict) {
    const bytes = this.bytes();
    const len = bytes.length;
    if (len <= ASCII_MAX_LENGTH) {
      const codes = new Array(len);
      for (let i = 0; i < len; i++) {
        const byte = bytes[i];
        if (byte > 127) {
          return this.decodeUtf8(bytes, strict);
        }
        codes[i] = byte;
      }
      return String.fromCharCode.apply(String, codes);
    }
    return this.decodeUtf8(bytes, strict);
  }
};
function assertInt32(arg) {
  if (typeof arg == "string") {
    arg = Number(arg);
  } else if (typeof arg != "number") {
    throw new Error("invalid int32: " + typeof arg);
  }
  if (!Number.isInteger(arg) || arg > INT32_MAX || arg < INT32_MIN)
    throw new Error("invalid int32: " + arg);
}
function assertUInt32(arg) {
  if (typeof arg == "string") {
    arg = Number(arg);
  } else if (typeof arg != "number") {
    throw new Error("invalid uint32: " + typeof arg);
  }
  if (!Number.isInteger(arg) || arg > UINT32_MAX || arg < 0)
    throw new Error("invalid uint32: " + arg);
}
function assertFloat32(arg) {
  if (typeof arg == "string") {
    const o2 = arg;
    arg = Number(arg);
    if (Number.isNaN(arg) && o2 !== "NaN") {
      throw new Error("invalid float32: " + o2);
    }
  } else if (typeof arg != "number") {
    throw new Error("invalid float32: " + typeof arg);
  }
  if (Number.isFinite(arg) && (arg > FLOAT32_MAX || arg < FLOAT32_MIN))
    throw new Error("invalid float32: " + arg);
}

// node_modules/.pnpm/@ag-ui+proto@0.0.58/node_modules/@ag-ui/proto/dist/index.mjs
var NullValue = /* @__PURE__ */ (function(NullValue2) {
  NullValue2[NullValue2["NULL_VALUE"] = 0] = "NULL_VALUE";
  NullValue2[NullValue2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
  return NullValue2;
})({});
function createBaseStruct() {
  return { fields: {} };
}
var Struct = {
  encode(message, writer = new BinaryWriter()) {
    Object.entries(message.fields).forEach(([key, value]) => {
      if (value !== void 0) Struct_FieldsEntry.encode({
        key,
        value
      }, writer.uint32(10).fork()).join();
    });
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseStruct();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) break;
          const entry1 = Struct_FieldsEntry.decode(reader, reader.uint32());
          if (entry1.value !== void 0) message.fields[entry1.key] = entry1.value;
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return Struct.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseStruct();
    message.fields = Object.entries(object.fields ?? {}).reduce((acc, [key, value]) => {
      if (value !== void 0) acc[key] = value;
      return acc;
    }, {});
    return message;
  },
  wrap(object) {
    const struct = createBaseStruct();
    if (object !== void 0) for (const key of Object.keys(object)) struct.fields[key] = object[key];
    return struct;
  },
  unwrap(message) {
    const object = {};
    if (message.fields) for (const key of Object.keys(message.fields)) object[key] = message.fields[key];
    return object;
  }
};
function createBaseStruct_FieldsEntry() {
  return {
    key: "",
    value: void 0
  };
}
var Struct_FieldsEntry = {
  encode(message, writer = new BinaryWriter()) {
    if (message.key !== "") writer.uint32(10).string(message.key);
    if (message.value !== void 0) Value.encode(Value.wrap(message.value), writer.uint32(18).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseStruct_FieldsEntry();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.key = reader.string();
          continue;
        case 2:
          if (tag !== 18) break;
          message.value = Value.unwrap(Value.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return Struct_FieldsEntry.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseStruct_FieldsEntry();
    message.key = object.key ?? "";
    message.value = object.value ?? void 0;
    return message;
  }
};
function createBaseValue() {
  return {
    nullValue: void 0,
    numberValue: void 0,
    stringValue: void 0,
    boolValue: void 0,
    structValue: void 0,
    listValue: void 0
  };
}
var Value = {
  encode(message, writer = new BinaryWriter()) {
    if (message.nullValue !== void 0) writer.uint32(8).int32(message.nullValue);
    if (message.numberValue !== void 0) writer.uint32(17).double(message.numberValue);
    if (message.stringValue !== void 0) writer.uint32(26).string(message.stringValue);
    if (message.boolValue !== void 0) writer.uint32(32).bool(message.boolValue);
    if (message.structValue !== void 0) Struct.encode(Struct.wrap(message.structValue), writer.uint32(42).fork()).join();
    if (message.listValue !== void 0) ListValue.encode(ListValue.wrap(message.listValue), writer.uint32(50).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseValue();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) break;
          message.nullValue = reader.int32();
          continue;
        case 2:
          if (tag !== 17) break;
          message.numberValue = reader.double();
          continue;
        case 3:
          if (tag !== 26) break;
          message.stringValue = reader.string();
          continue;
        case 4:
          if (tag !== 32) break;
          message.boolValue = reader.bool();
          continue;
        case 5:
          if (tag !== 42) break;
          message.structValue = Struct.unwrap(Struct.decode(reader, reader.uint32()));
          continue;
        case 6:
          if (tag !== 50) break;
          message.listValue = ListValue.unwrap(ListValue.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return Value.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseValue();
    message.nullValue = object.nullValue ?? void 0;
    message.numberValue = object.numberValue ?? void 0;
    message.stringValue = object.stringValue ?? void 0;
    message.boolValue = object.boolValue ?? void 0;
    message.structValue = object.structValue ?? void 0;
    message.listValue = object.listValue ?? void 0;
    return message;
  },
  wrap(value) {
    const result = createBaseValue();
    if (value === null) result.nullValue = NullValue.NULL_VALUE;
    else if (typeof value === "boolean") result.boolValue = value;
    else if (typeof value === "number") result.numberValue = value;
    else if (typeof value === "string") result.stringValue = value;
    else if (globalThis.Array.isArray(value)) result.listValue = value;
    else if (typeof value === "object") result.structValue = value;
    else if (typeof value !== "undefined") throw new globalThis.Error("Unsupported any value type: " + typeof value);
    return result;
  },
  unwrap(message) {
    if (message.stringValue !== void 0) return message.stringValue;
    else if (message?.numberValue !== void 0) return message.numberValue;
    else if (message?.boolValue !== void 0) return message.boolValue;
    else if (message?.structValue !== void 0) return message.structValue;
    else if (message?.listValue !== void 0) return message.listValue;
    else if (message?.nullValue !== void 0) return null;
  }
};
function createBaseListValue() {
  return { values: [] };
}
var ListValue = {
  encode(message, writer = new BinaryWriter()) {
    for (const v2 of message.values) Value.encode(Value.wrap(v2), writer.uint32(10).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseListValue();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.values.push(Value.unwrap(Value.decode(reader, reader.uint32())));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return ListValue.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseListValue();
    message.values = object.values?.map((e) => e) || [];
    return message;
  },
  wrap(array) {
    const result = createBaseListValue();
    result.values = array ?? [];
    return result;
  },
  unwrap(message) {
    if (message?.hasOwnProperty("values") && globalThis.Array.isArray(message.values)) return message.values;
    else return message;
  }
};
var JsonPatchOperationType = /* @__PURE__ */ (function(JsonPatchOperationType2) {
  JsonPatchOperationType2[JsonPatchOperationType2["ADD"] = 0] = "ADD";
  JsonPatchOperationType2[JsonPatchOperationType2["REMOVE"] = 1] = "REMOVE";
  JsonPatchOperationType2[JsonPatchOperationType2["REPLACE"] = 2] = "REPLACE";
  JsonPatchOperationType2[JsonPatchOperationType2["MOVE"] = 3] = "MOVE";
  JsonPatchOperationType2[JsonPatchOperationType2["COPY"] = 4] = "COPY";
  JsonPatchOperationType2[JsonPatchOperationType2["TEST"] = 5] = "TEST";
  JsonPatchOperationType2[JsonPatchOperationType2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
  return JsonPatchOperationType2;
})({});
function createBaseJsonPatchOperation() {
  return {
    op: 0,
    path: "",
    from: void 0,
    value: void 0
  };
}
var JsonPatchOperation = {
  encode(message, writer = new BinaryWriter()) {
    if (message.op !== 0) writer.uint32(8).int32(message.op);
    if (message.path !== "") writer.uint32(18).string(message.path);
    if (message.from !== void 0) writer.uint32(26).string(message.from);
    if (message.value !== void 0) Value.encode(Value.wrap(message.value), writer.uint32(34).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseJsonPatchOperation();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) break;
          message.op = reader.int32();
          continue;
        case 2:
          if (tag !== 18) break;
          message.path = reader.string();
          continue;
        case 3:
          if (tag !== 26) break;
          message.from = reader.string();
          continue;
        case 4:
          if (tag !== 34) break;
          message.value = Value.unwrap(Value.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return JsonPatchOperation.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseJsonPatchOperation();
    message.op = object.op ?? 0;
    message.path = object.path ?? "";
    message.from = object.from ?? void 0;
    message.value = object.value ?? void 0;
    return message;
  }
};
function createBaseToolCall() {
  return {
    id: "",
    type: "",
    function: void 0
  };
}
var ToolCall = {
  encode(message, writer = new BinaryWriter()) {
    if (message.id !== "") writer.uint32(10).string(message.id);
    if (message.type !== "") writer.uint32(18).string(message.type);
    if (message.function !== void 0) ToolCall_Function.encode(message.function, writer.uint32(26).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseToolCall();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.id = reader.string();
          continue;
        case 2:
          if (tag !== 18) break;
          message.type = reader.string();
          continue;
        case 3:
          if (tag !== 26) break;
          message.function = ToolCall_Function.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return ToolCall.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseToolCall();
    message.id = object.id ?? "";
    message.type = object.type ?? "";
    message.function = object.function !== void 0 && object.function !== null ? ToolCall_Function.fromPartial(object.function) : void 0;
    return message;
  }
};
function createBaseToolCall_Function() {
  return {
    name: "",
    arguments: ""
  };
}
var ToolCall_Function = {
  encode(message, writer = new BinaryWriter()) {
    if (message.name !== "") writer.uint32(10).string(message.name);
    if (message.arguments !== "") writer.uint32(18).string(message.arguments);
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseToolCall_Function();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.name = reader.string();
          continue;
        case 2:
          if (tag !== 18) break;
          message.arguments = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return ToolCall_Function.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseToolCall_Function();
    message.name = object.name ?? "";
    message.arguments = object.arguments ?? "";
    return message;
  }
};
function createBaseInputContentDataSource() {
  return {
    value: "",
    mimeType: ""
  };
}
var InputContentDataSource = {
  encode(message, writer = new BinaryWriter()) {
    if (message.value !== "") writer.uint32(10).string(message.value);
    if (message.mimeType !== "") writer.uint32(18).string(message.mimeType);
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseInputContentDataSource();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.value = reader.string();
          continue;
        case 2:
          if (tag !== 18) break;
          message.mimeType = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return InputContentDataSource.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseInputContentDataSource();
    message.value = object.value ?? "";
    message.mimeType = object.mimeType ?? "";
    return message;
  }
};
function createBaseInputContentUrlSource() {
  return {
    value: "",
    mimeType: void 0
  };
}
var InputContentUrlSource = {
  encode(message, writer = new BinaryWriter()) {
    if (message.value !== "") writer.uint32(10).string(message.value);
    if (message.mimeType !== void 0) writer.uint32(18).string(message.mimeType);
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseInputContentUrlSource();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.value = reader.string();
          continue;
        case 2:
          if (tag !== 18) break;
          message.mimeType = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return InputContentUrlSource.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseInputContentUrlSource();
    message.value = object.value ?? "";
    message.mimeType = object.mimeType ?? void 0;
    return message;
  }
};
function createBaseInputContentSource() {
  return {
    data: void 0,
    url: void 0
  };
}
var InputContentSource = {
  encode(message, writer = new BinaryWriter()) {
    if (message.data !== void 0) InputContentDataSource.encode(message.data, writer.uint32(10).fork()).join();
    if (message.url !== void 0) InputContentUrlSource.encode(message.url, writer.uint32(18).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseInputContentSource();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.data = InputContentDataSource.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.url = InputContentUrlSource.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return InputContentSource.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseInputContentSource();
    message.data = object.data !== void 0 && object.data !== null ? InputContentDataSource.fromPartial(object.data) : void 0;
    message.url = object.url !== void 0 && object.url !== null ? InputContentUrlSource.fromPartial(object.url) : void 0;
    return message;
  }
};
function createBaseTextInputPart() {
  return { text: "" };
}
var TextInputPart = {
  encode(message, writer = new BinaryWriter()) {
    if (message.text !== "") writer.uint32(10).string(message.text);
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseTextInputPart();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.text = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return TextInputPart.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseTextInputPart();
    message.text = object.text ?? "";
    return message;
  }
};
function createBaseImageInputPart() {
  return {
    source: void 0,
    metadata: void 0
  };
}
var ImageInputPart = {
  encode(message, writer = new BinaryWriter()) {
    if (message.source !== void 0) InputContentSource.encode(message.source, writer.uint32(10).fork()).join();
    if (message.metadata !== void 0) Value.encode(Value.wrap(message.metadata), writer.uint32(18).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseImageInputPart();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.source = InputContentSource.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.metadata = Value.unwrap(Value.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return ImageInputPart.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseImageInputPart();
    message.source = object.source !== void 0 && object.source !== null ? InputContentSource.fromPartial(object.source) : void 0;
    message.metadata = object.metadata ?? void 0;
    return message;
  }
};
function createBaseAudioInputPart() {
  return {
    source: void 0,
    metadata: void 0
  };
}
var AudioInputPart = {
  encode(message, writer = new BinaryWriter()) {
    if (message.source !== void 0) InputContentSource.encode(message.source, writer.uint32(10).fork()).join();
    if (message.metadata !== void 0) Value.encode(Value.wrap(message.metadata), writer.uint32(18).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseAudioInputPart();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.source = InputContentSource.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.metadata = Value.unwrap(Value.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return AudioInputPart.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseAudioInputPart();
    message.source = object.source !== void 0 && object.source !== null ? InputContentSource.fromPartial(object.source) : void 0;
    message.metadata = object.metadata ?? void 0;
    return message;
  }
};
function createBaseVideoInputPart() {
  return {
    source: void 0,
    metadata: void 0
  };
}
var VideoInputPart = {
  encode(message, writer = new BinaryWriter()) {
    if (message.source !== void 0) InputContentSource.encode(message.source, writer.uint32(10).fork()).join();
    if (message.metadata !== void 0) Value.encode(Value.wrap(message.metadata), writer.uint32(18).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseVideoInputPart();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.source = InputContentSource.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.metadata = Value.unwrap(Value.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return VideoInputPart.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseVideoInputPart();
    message.source = object.source !== void 0 && object.source !== null ? InputContentSource.fromPartial(object.source) : void 0;
    message.metadata = object.metadata ?? void 0;
    return message;
  }
};
function createBaseDocumentInputPart() {
  return {
    source: void 0,
    metadata: void 0
  };
}
var DocumentInputPart = {
  encode(message, writer = new BinaryWriter()) {
    if (message.source !== void 0) InputContentSource.encode(message.source, writer.uint32(10).fork()).join();
    if (message.metadata !== void 0) Value.encode(Value.wrap(message.metadata), writer.uint32(18).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseDocumentInputPart();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.source = InputContentSource.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.metadata = Value.unwrap(Value.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return DocumentInputPart.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseDocumentInputPart();
    message.source = object.source !== void 0 && object.source !== null ? InputContentSource.fromPartial(object.source) : void 0;
    message.metadata = object.metadata ?? void 0;
    return message;
  }
};
function createBaseInputContent() {
  return {
    text: void 0,
    image: void 0,
    audio: void 0,
    video: void 0,
    document: void 0
  };
}
var InputContent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.text !== void 0) TextInputPart.encode(message.text, writer.uint32(10).fork()).join();
    if (message.image !== void 0) ImageInputPart.encode(message.image, writer.uint32(18).fork()).join();
    if (message.audio !== void 0) AudioInputPart.encode(message.audio, writer.uint32(26).fork()).join();
    if (message.video !== void 0) VideoInputPart.encode(message.video, writer.uint32(34).fork()).join();
    if (message.document !== void 0) DocumentInputPart.encode(message.document, writer.uint32(42).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseInputContent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.text = TextInputPart.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.image = ImageInputPart.decode(reader, reader.uint32());
          continue;
        case 3:
          if (tag !== 26) break;
          message.audio = AudioInputPart.decode(reader, reader.uint32());
          continue;
        case 4:
          if (tag !== 34) break;
          message.video = VideoInputPart.decode(reader, reader.uint32());
          continue;
        case 5:
          if (tag !== 42) break;
          message.document = DocumentInputPart.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return InputContent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseInputContent();
    message.text = object.text !== void 0 && object.text !== null ? TextInputPart.fromPartial(object.text) : void 0;
    message.image = object.image !== void 0 && object.image !== null ? ImageInputPart.fromPartial(object.image) : void 0;
    message.audio = object.audio !== void 0 && object.audio !== null ? AudioInputPart.fromPartial(object.audio) : void 0;
    message.video = object.video !== void 0 && object.video !== null ? VideoInputPart.fromPartial(object.video) : void 0;
    message.document = object.document !== void 0 && object.document !== null ? DocumentInputPart.fromPartial(object.document) : void 0;
    return message;
  }
};
function createBaseMessage() {
  return {
    id: "",
    role: "",
    content: void 0,
    name: void 0,
    toolCalls: [],
    toolCallId: void 0,
    error: void 0,
    contentParts: []
  };
}
var Message = {
  encode(message, writer = new BinaryWriter()) {
    if (message.id !== "") writer.uint32(10).string(message.id);
    if (message.role !== "") writer.uint32(18).string(message.role);
    if (message.content !== void 0) writer.uint32(26).string(message.content);
    if (message.name !== void 0) writer.uint32(34).string(message.name);
    for (const v2 of message.toolCalls) ToolCall.encode(v2, writer.uint32(42).fork()).join();
    if (message.toolCallId !== void 0) writer.uint32(50).string(message.toolCallId);
    if (message.error !== void 0) writer.uint32(58).string(message.error);
    for (const v2 of message.contentParts) InputContent.encode(v2, writer.uint32(66).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMessage();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.id = reader.string();
          continue;
        case 2:
          if (tag !== 18) break;
          message.role = reader.string();
          continue;
        case 3:
          if (tag !== 26) break;
          message.content = reader.string();
          continue;
        case 4:
          if (tag !== 34) break;
          message.name = reader.string();
          continue;
        case 5:
          if (tag !== 42) break;
          message.toolCalls.push(ToolCall.decode(reader, reader.uint32()));
          continue;
        case 6:
          if (tag !== 50) break;
          message.toolCallId = reader.string();
          continue;
        case 7:
          if (tag !== 58) break;
          message.error = reader.string();
          continue;
        case 8:
          if (tag !== 66) break;
          message.contentParts.push(InputContent.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return Message.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMessage();
    message.id = object.id ?? "";
    message.role = object.role ?? "";
    message.content = object.content ?? void 0;
    message.name = object.name ?? void 0;
    message.toolCalls = object.toolCalls?.map((e) => ToolCall.fromPartial(e)) || [];
    message.toolCallId = object.toolCallId ?? void 0;
    message.error = object.error ?? void 0;
    message.contentParts = object.contentParts?.map((e) => InputContent.fromPartial(e)) || [];
    return message;
  }
};
function createBaseInterrupt() {
  return {
    id: "",
    reason: "",
    message: void 0,
    toolCallId: void 0,
    responseSchema: void 0,
    expiresAt: void 0,
    metadata: void 0
  };
}
var Interrupt = {
  encode(message, writer = new BinaryWriter()) {
    if (message.id !== "") writer.uint32(10).string(message.id);
    if (message.reason !== "") writer.uint32(18).string(message.reason);
    if (message.message !== void 0) writer.uint32(26).string(message.message);
    if (message.toolCallId !== void 0) writer.uint32(34).string(message.toolCallId);
    if (message.responseSchema !== void 0) Value.encode(Value.wrap(message.responseSchema), writer.uint32(42).fork()).join();
    if (message.expiresAt !== void 0) writer.uint32(50).string(message.expiresAt);
    if (message.metadata !== void 0) Value.encode(Value.wrap(message.metadata), writer.uint32(58).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseInterrupt();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.id = reader.string();
          continue;
        case 2:
          if (tag !== 18) break;
          message.reason = reader.string();
          continue;
        case 3:
          if (tag !== 26) break;
          message.message = reader.string();
          continue;
        case 4:
          if (tag !== 34) break;
          message.toolCallId = reader.string();
          continue;
        case 5:
          if (tag !== 42) break;
          message.responseSchema = Value.unwrap(Value.decode(reader, reader.uint32()));
          continue;
        case 6:
          if (tag !== 50) break;
          message.expiresAt = reader.string();
          continue;
        case 7:
          if (tag !== 58) break;
          message.metadata = Value.unwrap(Value.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return Interrupt.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseInterrupt();
    message.id = object.id ?? "";
    message.reason = object.reason ?? "";
    message.message = object.message ?? void 0;
    message.toolCallId = object.toolCallId ?? void 0;
    message.responseSchema = object.responseSchema ?? void 0;
    message.expiresAt = object.expiresAt ?? void 0;
    message.metadata = object.metadata ?? void 0;
    return message;
  }
};
var EventType$1 = /* @__PURE__ */ (function(EventType2) {
  EventType2[EventType2["TEXT_MESSAGE_START"] = 0] = "TEXT_MESSAGE_START";
  EventType2[EventType2["TEXT_MESSAGE_CONTENT"] = 1] = "TEXT_MESSAGE_CONTENT";
  EventType2[EventType2["TEXT_MESSAGE_END"] = 2] = "TEXT_MESSAGE_END";
  EventType2[EventType2["TOOL_CALL_START"] = 3] = "TOOL_CALL_START";
  EventType2[EventType2["TOOL_CALL_ARGS"] = 4] = "TOOL_CALL_ARGS";
  EventType2[EventType2["TOOL_CALL_END"] = 5] = "TOOL_CALL_END";
  EventType2[EventType2["STATE_SNAPSHOT"] = 6] = "STATE_SNAPSHOT";
  EventType2[EventType2["STATE_DELTA"] = 7] = "STATE_DELTA";
  EventType2[EventType2["MESSAGES_SNAPSHOT"] = 8] = "MESSAGES_SNAPSHOT";
  EventType2[EventType2["RAW"] = 9] = "RAW";
  EventType2[EventType2["CUSTOM"] = 10] = "CUSTOM";
  EventType2[EventType2["RUN_STARTED"] = 11] = "RUN_STARTED";
  EventType2[EventType2["RUN_FINISHED"] = 12] = "RUN_FINISHED";
  EventType2[EventType2["RUN_ERROR"] = 13] = "RUN_ERROR";
  EventType2[EventType2["STEP_STARTED"] = 14] = "STEP_STARTED";
  EventType2[EventType2["STEP_FINISHED"] = 15] = "STEP_FINISHED";
  EventType2[EventType2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
  return EventType2;
})({});
function createBaseBaseEvent() {
  return {
    type: 0,
    timestamp: void 0,
    rawEvent: void 0
  };
}
var BaseEvent$1 = {
  encode(message, writer = new BinaryWriter()) {
    if (message.type !== 0) writer.uint32(8).int32(message.type);
    if (message.timestamp !== void 0) writer.uint32(16).int64(message.timestamp);
    if (message.rawEvent !== void 0) Value.encode(Value.wrap(message.rawEvent), writer.uint32(26).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseBaseEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) break;
          message.type = reader.int32();
          continue;
        case 2:
          if (tag !== 16) break;
          message.timestamp = longToNumber(reader.int64());
          continue;
        case 3:
          if (tag !== 26) break;
          message.rawEvent = Value.unwrap(Value.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return BaseEvent$1.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseBaseEvent();
    message.type = object.type ?? 0;
    message.timestamp = object.timestamp ?? void 0;
    message.rawEvent = object.rawEvent ?? void 0;
    return message;
  }
};
function createBaseTextMessageStartEvent() {
  return {
    baseEvent: void 0,
    messageId: "",
    role: void 0,
    name: void 0
  };
}
var TextMessageStartEvent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseEvent !== void 0) BaseEvent$1.encode(message.baseEvent, writer.uint32(10).fork()).join();
    if (message.messageId !== "") writer.uint32(18).string(message.messageId);
    if (message.role !== void 0) writer.uint32(26).string(message.role);
    if (message.name !== void 0) writer.uint32(34).string(message.name);
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseTextMessageStartEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.baseEvent = BaseEvent$1.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.messageId = reader.string();
          continue;
        case 3:
          if (tag !== 26) break;
          message.role = reader.string();
          continue;
        case 4:
          if (tag !== 34) break;
          message.name = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return TextMessageStartEvent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseTextMessageStartEvent();
    message.baseEvent = object.baseEvent !== void 0 && object.baseEvent !== null ? BaseEvent$1.fromPartial(object.baseEvent) : void 0;
    message.messageId = object.messageId ?? "";
    message.role = object.role ?? void 0;
    message.name = object.name ?? void 0;
    return message;
  }
};
function createBaseTextMessageContentEvent() {
  return {
    baseEvent: void 0,
    messageId: "",
    delta: ""
  };
}
var TextMessageContentEvent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseEvent !== void 0) BaseEvent$1.encode(message.baseEvent, writer.uint32(10).fork()).join();
    if (message.messageId !== "") writer.uint32(18).string(message.messageId);
    if (message.delta !== "") writer.uint32(26).string(message.delta);
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseTextMessageContentEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.baseEvent = BaseEvent$1.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.messageId = reader.string();
          continue;
        case 3:
          if (tag !== 26) break;
          message.delta = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return TextMessageContentEvent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseTextMessageContentEvent();
    message.baseEvent = object.baseEvent !== void 0 && object.baseEvent !== null ? BaseEvent$1.fromPartial(object.baseEvent) : void 0;
    message.messageId = object.messageId ?? "";
    message.delta = object.delta ?? "";
    return message;
  }
};
function createBaseTextMessageEndEvent() {
  return {
    baseEvent: void 0,
    messageId: ""
  };
}
var TextMessageEndEvent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseEvent !== void 0) BaseEvent$1.encode(message.baseEvent, writer.uint32(10).fork()).join();
    if (message.messageId !== "") writer.uint32(18).string(message.messageId);
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseTextMessageEndEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.baseEvent = BaseEvent$1.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.messageId = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return TextMessageEndEvent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseTextMessageEndEvent();
    message.baseEvent = object.baseEvent !== void 0 && object.baseEvent !== null ? BaseEvent$1.fromPartial(object.baseEvent) : void 0;
    message.messageId = object.messageId ?? "";
    return message;
  }
};
function createBaseToolCallStartEvent() {
  return {
    baseEvent: void 0,
    toolCallId: "",
    toolCallName: "",
    parentMessageId: void 0
  };
}
var ToolCallStartEvent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseEvent !== void 0) BaseEvent$1.encode(message.baseEvent, writer.uint32(10).fork()).join();
    if (message.toolCallId !== "") writer.uint32(18).string(message.toolCallId);
    if (message.toolCallName !== "") writer.uint32(26).string(message.toolCallName);
    if (message.parentMessageId !== void 0) writer.uint32(34).string(message.parentMessageId);
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseToolCallStartEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.baseEvent = BaseEvent$1.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.toolCallId = reader.string();
          continue;
        case 3:
          if (tag !== 26) break;
          message.toolCallName = reader.string();
          continue;
        case 4:
          if (tag !== 34) break;
          message.parentMessageId = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return ToolCallStartEvent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseToolCallStartEvent();
    message.baseEvent = object.baseEvent !== void 0 && object.baseEvent !== null ? BaseEvent$1.fromPartial(object.baseEvent) : void 0;
    message.toolCallId = object.toolCallId ?? "";
    message.toolCallName = object.toolCallName ?? "";
    message.parentMessageId = object.parentMessageId ?? void 0;
    return message;
  }
};
function createBaseToolCallArgsEvent() {
  return {
    baseEvent: void 0,
    toolCallId: "",
    delta: ""
  };
}
var ToolCallArgsEvent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseEvent !== void 0) BaseEvent$1.encode(message.baseEvent, writer.uint32(10).fork()).join();
    if (message.toolCallId !== "") writer.uint32(18).string(message.toolCallId);
    if (message.delta !== "") writer.uint32(26).string(message.delta);
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseToolCallArgsEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.baseEvent = BaseEvent$1.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.toolCallId = reader.string();
          continue;
        case 3:
          if (tag !== 26) break;
          message.delta = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return ToolCallArgsEvent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseToolCallArgsEvent();
    message.baseEvent = object.baseEvent !== void 0 && object.baseEvent !== null ? BaseEvent$1.fromPartial(object.baseEvent) : void 0;
    message.toolCallId = object.toolCallId ?? "";
    message.delta = object.delta ?? "";
    return message;
  }
};
function createBaseToolCallEndEvent() {
  return {
    baseEvent: void 0,
    toolCallId: ""
  };
}
var ToolCallEndEvent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseEvent !== void 0) BaseEvent$1.encode(message.baseEvent, writer.uint32(10).fork()).join();
    if (message.toolCallId !== "") writer.uint32(18).string(message.toolCallId);
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseToolCallEndEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.baseEvent = BaseEvent$1.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.toolCallId = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return ToolCallEndEvent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseToolCallEndEvent();
    message.baseEvent = object.baseEvent !== void 0 && object.baseEvent !== null ? BaseEvent$1.fromPartial(object.baseEvent) : void 0;
    message.toolCallId = object.toolCallId ?? "";
    return message;
  }
};
function createBaseStateSnapshotEvent() {
  return {
    baseEvent: void 0,
    snapshot: void 0
  };
}
var StateSnapshotEvent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseEvent !== void 0) BaseEvent$1.encode(message.baseEvent, writer.uint32(10).fork()).join();
    if (message.snapshot !== void 0) Value.encode(Value.wrap(message.snapshot), writer.uint32(18).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseStateSnapshotEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.baseEvent = BaseEvent$1.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.snapshot = Value.unwrap(Value.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return StateSnapshotEvent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseStateSnapshotEvent();
    message.baseEvent = object.baseEvent !== void 0 && object.baseEvent !== null ? BaseEvent$1.fromPartial(object.baseEvent) : void 0;
    message.snapshot = object.snapshot ?? void 0;
    return message;
  }
};
function createBaseStateDeltaEvent() {
  return {
    baseEvent: void 0,
    delta: []
  };
}
var StateDeltaEvent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseEvent !== void 0) BaseEvent$1.encode(message.baseEvent, writer.uint32(10).fork()).join();
    for (const v2 of message.delta) JsonPatchOperation.encode(v2, writer.uint32(18).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseStateDeltaEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.baseEvent = BaseEvent$1.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.delta.push(JsonPatchOperation.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return StateDeltaEvent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseStateDeltaEvent();
    message.baseEvent = object.baseEvent !== void 0 && object.baseEvent !== null ? BaseEvent$1.fromPartial(object.baseEvent) : void 0;
    message.delta = object.delta?.map((e) => JsonPatchOperation.fromPartial(e)) || [];
    return message;
  }
};
function createBaseMessagesSnapshotEvent() {
  return {
    baseEvent: void 0,
    messages: []
  };
}
var MessagesSnapshotEvent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseEvent !== void 0) BaseEvent$1.encode(message.baseEvent, writer.uint32(10).fork()).join();
    for (const v2 of message.messages) Message.encode(v2, writer.uint32(18).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMessagesSnapshotEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.baseEvent = BaseEvent$1.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.messages.push(Message.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return MessagesSnapshotEvent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMessagesSnapshotEvent();
    message.baseEvent = object.baseEvent !== void 0 && object.baseEvent !== null ? BaseEvent$1.fromPartial(object.baseEvent) : void 0;
    message.messages = object.messages?.map((e) => Message.fromPartial(e)) || [];
    return message;
  }
};
function createBaseRawEvent() {
  return {
    baseEvent: void 0,
    event: void 0,
    source: void 0
  };
}
var RawEvent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseEvent !== void 0) BaseEvent$1.encode(message.baseEvent, writer.uint32(10).fork()).join();
    if (message.event !== void 0) Value.encode(Value.wrap(message.event), writer.uint32(18).fork()).join();
    if (message.source !== void 0) writer.uint32(26).string(message.source);
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseRawEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.baseEvent = BaseEvent$1.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.event = Value.unwrap(Value.decode(reader, reader.uint32()));
          continue;
        case 3:
          if (tag !== 26) break;
          message.source = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return RawEvent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseRawEvent();
    message.baseEvent = object.baseEvent !== void 0 && object.baseEvent !== null ? BaseEvent$1.fromPartial(object.baseEvent) : void 0;
    message.event = object.event ?? void 0;
    message.source = object.source ?? void 0;
    return message;
  }
};
function createBaseCustomEvent() {
  return {
    baseEvent: void 0,
    name: "",
    value: void 0
  };
}
var CustomEvent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseEvent !== void 0) BaseEvent$1.encode(message.baseEvent, writer.uint32(10).fork()).join();
    if (message.name !== "") writer.uint32(18).string(message.name);
    if (message.value !== void 0) Value.encode(Value.wrap(message.value), writer.uint32(26).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseCustomEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.baseEvent = BaseEvent$1.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.name = reader.string();
          continue;
        case 3:
          if (tag !== 26) break;
          message.value = Value.unwrap(Value.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return CustomEvent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseCustomEvent();
    message.baseEvent = object.baseEvent !== void 0 && object.baseEvent !== null ? BaseEvent$1.fromPartial(object.baseEvent) : void 0;
    message.name = object.name ?? "";
    message.value = object.value ?? void 0;
    return message;
  }
};
function createBaseRunStartedEvent() {
  return {
    baseEvent: void 0,
    threadId: "",
    runId: ""
  };
}
var RunStartedEvent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseEvent !== void 0) BaseEvent$1.encode(message.baseEvent, writer.uint32(10).fork()).join();
    if (message.threadId !== "") writer.uint32(18).string(message.threadId);
    if (message.runId !== "") writer.uint32(26).string(message.runId);
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseRunStartedEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.baseEvent = BaseEvent$1.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.threadId = reader.string();
          continue;
        case 3:
          if (tag !== 26) break;
          message.runId = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return RunStartedEvent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseRunStartedEvent();
    message.baseEvent = object.baseEvent !== void 0 && object.baseEvent !== null ? BaseEvent$1.fromPartial(object.baseEvent) : void 0;
    message.threadId = object.threadId ?? "";
    message.runId = object.runId ?? "";
    return message;
  }
};
function createBaseUsage() {
  return {
    provider: void 0,
    model: void 0,
    inputTokens: void 0,
    outputTokens: void 0,
    totalTokens: void 0,
    reasoningTokens: void 0,
    cachedInputTokens: void 0
  };
}
var Usage = {
  encode(message, writer = new BinaryWriter()) {
    if (message.provider !== void 0) writer.uint32(10).string(message.provider);
    if (message.model !== void 0) writer.uint32(18).string(message.model);
    if (message.inputTokens !== void 0) writer.uint32(24).int64(message.inputTokens);
    if (message.outputTokens !== void 0) writer.uint32(32).int64(message.outputTokens);
    if (message.totalTokens !== void 0) writer.uint32(40).int64(message.totalTokens);
    if (message.reasoningTokens !== void 0) writer.uint32(48).int64(message.reasoningTokens);
    if (message.cachedInputTokens !== void 0) writer.uint32(56).int64(message.cachedInputTokens);
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseUsage();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.provider = reader.string();
          continue;
        case 2:
          if (tag !== 18) break;
          message.model = reader.string();
          continue;
        case 3:
          if (tag !== 24) break;
          message.inputTokens = longToNumber(reader.int64());
          continue;
        case 4:
          if (tag !== 32) break;
          message.outputTokens = longToNumber(reader.int64());
          continue;
        case 5:
          if (tag !== 40) break;
          message.totalTokens = longToNumber(reader.int64());
          continue;
        case 6:
          if (tag !== 48) break;
          message.reasoningTokens = longToNumber(reader.int64());
          continue;
        case 7:
          if (tag !== 56) break;
          message.cachedInputTokens = longToNumber(reader.int64());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return Usage.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseUsage();
    message.provider = object.provider ?? void 0;
    message.model = object.model ?? void 0;
    message.inputTokens = object.inputTokens ?? void 0;
    message.outputTokens = object.outputTokens ?? void 0;
    message.totalTokens = object.totalTokens ?? void 0;
    message.reasoningTokens = object.reasoningTokens ?? void 0;
    message.cachedInputTokens = object.cachedInputTokens ?? void 0;
    return message;
  }
};
function createBaseRunFinishedEvent() {
  return {
    baseEvent: void 0,
    threadId: "",
    runId: "",
    result: void 0,
    outcome: "",
    interrupts: [],
    usage: []
  };
}
var RunFinishedEvent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseEvent !== void 0) BaseEvent$1.encode(message.baseEvent, writer.uint32(10).fork()).join();
    if (message.threadId !== "") writer.uint32(18).string(message.threadId);
    if (message.runId !== "") writer.uint32(26).string(message.runId);
    if (message.result !== void 0) Value.encode(Value.wrap(message.result), writer.uint32(34).fork()).join();
    if (message.outcome !== "") writer.uint32(42).string(message.outcome);
    for (const v2 of message.interrupts) Interrupt.encode(v2, writer.uint32(50).fork()).join();
    for (const v2 of message.usage) Usage.encode(v2, writer.uint32(58).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseRunFinishedEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.baseEvent = BaseEvent$1.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.threadId = reader.string();
          continue;
        case 3:
          if (tag !== 26) break;
          message.runId = reader.string();
          continue;
        case 4:
          if (tag !== 34) break;
          message.result = Value.unwrap(Value.decode(reader, reader.uint32()));
          continue;
        case 5:
          if (tag !== 42) break;
          message.outcome = reader.string();
          continue;
        case 6:
          if (tag !== 50) break;
          message.interrupts.push(Interrupt.decode(reader, reader.uint32()));
          continue;
        case 7:
          if (tag !== 58) break;
          message.usage.push(Usage.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return RunFinishedEvent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseRunFinishedEvent();
    message.baseEvent = object.baseEvent !== void 0 && object.baseEvent !== null ? BaseEvent$1.fromPartial(object.baseEvent) : void 0;
    message.threadId = object.threadId ?? "";
    message.runId = object.runId ?? "";
    message.result = object.result ?? void 0;
    message.outcome = object.outcome ?? "";
    message.interrupts = object.interrupts?.map((e) => Interrupt.fromPartial(e)) || [];
    message.usage = object.usage?.map((e) => Usage.fromPartial(e)) || [];
    return message;
  }
};
function createBaseRunErrorEvent() {
  return {
    baseEvent: void 0,
    code: void 0,
    message: "",
    usage: []
  };
}
var RunErrorEvent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseEvent !== void 0) BaseEvent$1.encode(message.baseEvent, writer.uint32(10).fork()).join();
    if (message.code !== void 0) writer.uint32(18).string(message.code);
    if (message.message !== "") writer.uint32(26).string(message.message);
    for (const v2 of message.usage) Usage.encode(v2, writer.uint32(34).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseRunErrorEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.baseEvent = BaseEvent$1.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.code = reader.string();
          continue;
        case 3:
          if (tag !== 26) break;
          message.message = reader.string();
          continue;
        case 4:
          if (tag !== 34) break;
          message.usage.push(Usage.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return RunErrorEvent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseRunErrorEvent();
    message.baseEvent = object.baseEvent !== void 0 && object.baseEvent !== null ? BaseEvent$1.fromPartial(object.baseEvent) : void 0;
    message.code = object.code ?? void 0;
    message.message = object.message ?? "";
    message.usage = object.usage?.map((e) => Usage.fromPartial(e)) || [];
    return message;
  }
};
function createBaseStepStartedEvent() {
  return {
    baseEvent: void 0,
    stepName: ""
  };
}
var StepStartedEvent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseEvent !== void 0) BaseEvent$1.encode(message.baseEvent, writer.uint32(10).fork()).join();
    if (message.stepName !== "") writer.uint32(18).string(message.stepName);
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseStepStartedEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.baseEvent = BaseEvent$1.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.stepName = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return StepStartedEvent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseStepStartedEvent();
    message.baseEvent = object.baseEvent !== void 0 && object.baseEvent !== null ? BaseEvent$1.fromPartial(object.baseEvent) : void 0;
    message.stepName = object.stepName ?? "";
    return message;
  }
};
function createBaseStepFinishedEvent() {
  return {
    baseEvent: void 0,
    stepName: ""
  };
}
var StepFinishedEvent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseEvent !== void 0) BaseEvent$1.encode(message.baseEvent, writer.uint32(10).fork()).join();
    if (message.stepName !== "") writer.uint32(18).string(message.stepName);
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseStepFinishedEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.baseEvent = BaseEvent$1.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.stepName = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return StepFinishedEvent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseStepFinishedEvent();
    message.baseEvent = object.baseEvent !== void 0 && object.baseEvent !== null ? BaseEvent$1.fromPartial(object.baseEvent) : void 0;
    message.stepName = object.stepName ?? "";
    return message;
  }
};
function createBaseTextMessageChunkEvent() {
  return {
    baseEvent: void 0,
    messageId: void 0,
    role: void 0,
    delta: void 0,
    name: void 0
  };
}
var TextMessageChunkEvent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseEvent !== void 0) BaseEvent$1.encode(message.baseEvent, writer.uint32(10).fork()).join();
    if (message.messageId !== void 0) writer.uint32(18).string(message.messageId);
    if (message.role !== void 0) writer.uint32(26).string(message.role);
    if (message.delta !== void 0) writer.uint32(34).string(message.delta);
    if (message.name !== void 0) writer.uint32(42).string(message.name);
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseTextMessageChunkEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.baseEvent = BaseEvent$1.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.messageId = reader.string();
          continue;
        case 3:
          if (tag !== 26) break;
          message.role = reader.string();
          continue;
        case 4:
          if (tag !== 34) break;
          message.delta = reader.string();
          continue;
        case 5:
          if (tag !== 42) break;
          message.name = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return TextMessageChunkEvent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseTextMessageChunkEvent();
    message.baseEvent = object.baseEvent !== void 0 && object.baseEvent !== null ? BaseEvent$1.fromPartial(object.baseEvent) : void 0;
    message.messageId = object.messageId ?? void 0;
    message.role = object.role ?? void 0;
    message.delta = object.delta ?? void 0;
    message.name = object.name ?? void 0;
    return message;
  }
};
function createBaseToolCallChunkEvent() {
  return {
    baseEvent: void 0,
    toolCallId: void 0,
    toolCallName: void 0,
    parentMessageId: void 0,
    delta: void 0
  };
}
var ToolCallChunkEvent = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseEvent !== void 0) BaseEvent$1.encode(message.baseEvent, writer.uint32(10).fork()).join();
    if (message.toolCallId !== void 0) writer.uint32(18).string(message.toolCallId);
    if (message.toolCallName !== void 0) writer.uint32(26).string(message.toolCallName);
    if (message.parentMessageId !== void 0) writer.uint32(34).string(message.parentMessageId);
    if (message.delta !== void 0) writer.uint32(42).string(message.delta);
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseToolCallChunkEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.baseEvent = BaseEvent$1.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.toolCallId = reader.string();
          continue;
        case 3:
          if (tag !== 26) break;
          message.toolCallName = reader.string();
          continue;
        case 4:
          if (tag !== 34) break;
          message.parentMessageId = reader.string();
          continue;
        case 5:
          if (tag !== 42) break;
          message.delta = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return ToolCallChunkEvent.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseToolCallChunkEvent();
    message.baseEvent = object.baseEvent !== void 0 && object.baseEvent !== null ? BaseEvent$1.fromPartial(object.baseEvent) : void 0;
    message.toolCallId = object.toolCallId ?? void 0;
    message.toolCallName = object.toolCallName ?? void 0;
    message.parentMessageId = object.parentMessageId ?? void 0;
    message.delta = object.delta ?? void 0;
    return message;
  }
};
function createBaseEvent() {
  return {
    textMessageStart: void 0,
    textMessageContent: void 0,
    textMessageEnd: void 0,
    toolCallStart: void 0,
    toolCallArgs: void 0,
    toolCallEnd: void 0,
    stateSnapshot: void 0,
    stateDelta: void 0,
    messagesSnapshot: void 0,
    raw: void 0,
    custom: void 0,
    runStarted: void 0,
    runFinished: void 0,
    runError: void 0,
    stepStarted: void 0,
    stepFinished: void 0,
    textMessageChunk: void 0,
    toolCallChunk: void 0
  };
}
var Event = {
  encode(message, writer = new BinaryWriter()) {
    if (message.textMessageStart !== void 0) TextMessageStartEvent.encode(message.textMessageStart, writer.uint32(10).fork()).join();
    if (message.textMessageContent !== void 0) TextMessageContentEvent.encode(message.textMessageContent, writer.uint32(18).fork()).join();
    if (message.textMessageEnd !== void 0) TextMessageEndEvent.encode(message.textMessageEnd, writer.uint32(26).fork()).join();
    if (message.toolCallStart !== void 0) ToolCallStartEvent.encode(message.toolCallStart, writer.uint32(34).fork()).join();
    if (message.toolCallArgs !== void 0) ToolCallArgsEvent.encode(message.toolCallArgs, writer.uint32(42).fork()).join();
    if (message.toolCallEnd !== void 0) ToolCallEndEvent.encode(message.toolCallEnd, writer.uint32(50).fork()).join();
    if (message.stateSnapshot !== void 0) StateSnapshotEvent.encode(message.stateSnapshot, writer.uint32(58).fork()).join();
    if (message.stateDelta !== void 0) StateDeltaEvent.encode(message.stateDelta, writer.uint32(66).fork()).join();
    if (message.messagesSnapshot !== void 0) MessagesSnapshotEvent.encode(message.messagesSnapshot, writer.uint32(74).fork()).join();
    if (message.raw !== void 0) RawEvent.encode(message.raw, writer.uint32(82).fork()).join();
    if (message.custom !== void 0) CustomEvent.encode(message.custom, writer.uint32(90).fork()).join();
    if (message.runStarted !== void 0) RunStartedEvent.encode(message.runStarted, writer.uint32(98).fork()).join();
    if (message.runFinished !== void 0) RunFinishedEvent.encode(message.runFinished, writer.uint32(106).fork()).join();
    if (message.runError !== void 0) RunErrorEvent.encode(message.runError, writer.uint32(114).fork()).join();
    if (message.stepStarted !== void 0) StepStartedEvent.encode(message.stepStarted, writer.uint32(122).fork()).join();
    if (message.stepFinished !== void 0) StepFinishedEvent.encode(message.stepFinished, writer.uint32(130).fork()).join();
    if (message.textMessageChunk !== void 0) TextMessageChunkEvent.encode(message.textMessageChunk, writer.uint32(138).fork()).join();
    if (message.toolCallChunk !== void 0) ToolCallChunkEvent.encode(message.toolCallChunk, writer.uint32(146).fork()).join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.textMessageStart = TextMessageStartEvent.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) break;
          message.textMessageContent = TextMessageContentEvent.decode(reader, reader.uint32());
          continue;
        case 3:
          if (tag !== 26) break;
          message.textMessageEnd = TextMessageEndEvent.decode(reader, reader.uint32());
          continue;
        case 4:
          if (tag !== 34) break;
          message.toolCallStart = ToolCallStartEvent.decode(reader, reader.uint32());
          continue;
        case 5:
          if (tag !== 42) break;
          message.toolCallArgs = ToolCallArgsEvent.decode(reader, reader.uint32());
          continue;
        case 6:
          if (tag !== 50) break;
          message.toolCallEnd = ToolCallEndEvent.decode(reader, reader.uint32());
          continue;
        case 7:
          if (tag !== 58) break;
          message.stateSnapshot = StateSnapshotEvent.decode(reader, reader.uint32());
          continue;
        case 8:
          if (tag !== 66) break;
          message.stateDelta = StateDeltaEvent.decode(reader, reader.uint32());
          continue;
        case 9:
          if (tag !== 74) break;
          message.messagesSnapshot = MessagesSnapshotEvent.decode(reader, reader.uint32());
          continue;
        case 10:
          if (tag !== 82) break;
          message.raw = RawEvent.decode(reader, reader.uint32());
          continue;
        case 11:
          if (tag !== 90) break;
          message.custom = CustomEvent.decode(reader, reader.uint32());
          continue;
        case 12:
          if (tag !== 98) break;
          message.runStarted = RunStartedEvent.decode(reader, reader.uint32());
          continue;
        case 13:
          if (tag !== 106) break;
          message.runFinished = RunFinishedEvent.decode(reader, reader.uint32());
          continue;
        case 14:
          if (tag !== 114) break;
          message.runError = RunErrorEvent.decode(reader, reader.uint32());
          continue;
        case 15:
          if (tag !== 122) break;
          message.stepStarted = StepStartedEvent.decode(reader, reader.uint32());
          continue;
        case 16:
          if (tag !== 130) break;
          message.stepFinished = StepFinishedEvent.decode(reader, reader.uint32());
          continue;
        case 17:
          if (tag !== 138) break;
          message.textMessageChunk = TextMessageChunkEvent.decode(reader, reader.uint32());
          continue;
        case 18:
          if (tag !== 146) break;
          message.toolCallChunk = ToolCallChunkEvent.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },
  create(base) {
    return Event.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseEvent();
    message.textMessageStart = object.textMessageStart !== void 0 && object.textMessageStart !== null ? TextMessageStartEvent.fromPartial(object.textMessageStart) : void 0;
    message.textMessageContent = object.textMessageContent !== void 0 && object.textMessageContent !== null ? TextMessageContentEvent.fromPartial(object.textMessageContent) : void 0;
    message.textMessageEnd = object.textMessageEnd !== void 0 && object.textMessageEnd !== null ? TextMessageEndEvent.fromPartial(object.textMessageEnd) : void 0;
    message.toolCallStart = object.toolCallStart !== void 0 && object.toolCallStart !== null ? ToolCallStartEvent.fromPartial(object.toolCallStart) : void 0;
    message.toolCallArgs = object.toolCallArgs !== void 0 && object.toolCallArgs !== null ? ToolCallArgsEvent.fromPartial(object.toolCallArgs) : void 0;
    message.toolCallEnd = object.toolCallEnd !== void 0 && object.toolCallEnd !== null ? ToolCallEndEvent.fromPartial(object.toolCallEnd) : void 0;
    message.stateSnapshot = object.stateSnapshot !== void 0 && object.stateSnapshot !== null ? StateSnapshotEvent.fromPartial(object.stateSnapshot) : void 0;
    message.stateDelta = object.stateDelta !== void 0 && object.stateDelta !== null ? StateDeltaEvent.fromPartial(object.stateDelta) : void 0;
    message.messagesSnapshot = object.messagesSnapshot !== void 0 && object.messagesSnapshot !== null ? MessagesSnapshotEvent.fromPartial(object.messagesSnapshot) : void 0;
    message.raw = object.raw !== void 0 && object.raw !== null ? RawEvent.fromPartial(object.raw) : void 0;
    message.custom = object.custom !== void 0 && object.custom !== null ? CustomEvent.fromPartial(object.custom) : void 0;
    message.runStarted = object.runStarted !== void 0 && object.runStarted !== null ? RunStartedEvent.fromPartial(object.runStarted) : void 0;
    message.runFinished = object.runFinished !== void 0 && object.runFinished !== null ? RunFinishedEvent.fromPartial(object.runFinished) : void 0;
    message.runError = object.runError !== void 0 && object.runError !== null ? RunErrorEvent.fromPartial(object.runError) : void 0;
    message.stepStarted = object.stepStarted !== void 0 && object.stepStarted !== null ? StepStartedEvent.fromPartial(object.stepStarted) : void 0;
    message.stepFinished = object.stepFinished !== void 0 && object.stepFinished !== null ? StepFinishedEvent.fromPartial(object.stepFinished) : void 0;
    message.textMessageChunk = object.textMessageChunk !== void 0 && object.textMessageChunk !== null ? TextMessageChunkEvent.fromPartial(object.textMessageChunk) : void 0;
    message.toolCallChunk = object.toolCallChunk !== void 0 && object.toolCallChunk !== null ? ToolCallChunkEvent.fromPartial(object.toolCallChunk) : void 0;
    return message;
  }
};
function longToNumber(int64) {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  if (num < globalThis.Number.MIN_SAFE_INTEGER) throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  return num;
}
var asRecord = (value) => value && typeof value === "object" ? value : void 0;
var fromProtoSource = (source) => {
  const rec = asRecord(source);
  if (!rec) return;
  if (rec.data) {
    const data = rec.data;
    return {
      type: "data",
      value: data.value,
      mimeType: data.mimeType
    };
  }
  if (rec.url) {
    const url = rec.url;
    return {
      type: "url",
      value: url.value,
      mimeType: url.mimeType
    };
  }
};
var fromProtoContentPart = (part) => {
  const rec = asRecord(part);
  if (!rec) return;
  if (rec.text) return {
    type: "text",
    text: rec.text.text
  };
  if (rec.image) {
    const image = rec.image;
    return {
      type: "image",
      source: fromProtoSource(image.source),
      metadata: image.metadata
    };
  }
  if (rec.audio) {
    const audio = rec.audio;
    return {
      type: "audio",
      source: fromProtoSource(audio.source),
      metadata: audio.metadata
    };
  }
  if (rec.video) {
    const video = rec.video;
    return {
      type: "video",
      source: fromProtoSource(video.source),
      metadata: video.metadata
    };
  }
  if (rec.document) {
    const document = rec.document;
    return {
      type: "document",
      source: fromProtoSource(document.source),
      metadata: document.metadata
    };
  }
};
function decode(data) {
  const event = Event.decode(data);
  const decoded = Object.values(event).find((value) => value !== void 0);
  if (!decoded) throw new Error("Invalid event");
  decoded.type = EventType$1[decoded.baseEvent.type];
  decoded.timestamp = decoded.baseEvent.timestamp;
  decoded.rawEvent = decoded.baseEvent.rawEvent;
  delete decoded.baseEvent;
  if (decoded.type === EventType.MESSAGES_SNAPSHOT) for (const message of decoded.messages) {
    const untypedMessage = message;
    if (untypedMessage.role === "user" && Array.isArray(untypedMessage.contentParts)) {
      const contentParts = untypedMessage.contentParts.map((part) => fromProtoContentPart(part)).filter((part) => part !== void 0);
      if (contentParts.length > 0) untypedMessage.content = contentParts;
    }
    if (Array.isArray(untypedMessage.contentParts) && untypedMessage.contentParts.length === 0) untypedMessage.contentParts = void 0;
    if (untypedMessage.toolCalls?.length === 0) untypedMessage.toolCalls = void 0;
  }
  if (decoded.type === EventType.RUN_FINISHED) {
    const runFinished = decoded;
    const wireOutcome = typeof runFinished.outcome === "string" && runFinished.outcome !== "" ? runFinished.outcome : void 0;
    const wireInterrupts = Array.isArray(runFinished.interrupts) ? runFinished.interrupts : [];
    delete runFinished.interrupts;
    if (wireOutcome === "interrupt") runFinished.outcome = {
      type: "interrupt",
      interrupts: wireInterrupts
    };
    else if (wireOutcome === "success") runFinished.outcome = { type: "success" };
    else delete runFinished.outcome;
  }
  if (decoded.type === EventType.RUN_FINISHED || decoded.type === EventType.RUN_ERROR) {
    if (Array.isArray(decoded.usage) && decoded.usage.length === 0) delete decoded.usage;
  }
  if (decoded.type === EventType.STATE_DELTA) for (const operation of decoded.delta) {
    operation.op = JsonPatchOperationType[operation.op].toLowerCase();
    Object.keys(operation).forEach((key) => {
      if (operation[key] === void 0) delete operation[key];
    });
  }
  Object.keys(decoded).forEach((key) => {
    if (decoded[key] === void 0) delete decoded[key];
  });
  return EventSchemas.parse(decoded);
}
var AGUI_MEDIA_TYPE = "application/vnd.ag-ui.event+proto";

// node_modules/.pnpm/@ag-ui+client@0.0.58/node_modules/@ag-ui/client/dist/index.mjs
var import_compare_versions = __toESM(require_umd(), 1);
var O = (e) => {
  if (typeof structuredClone == `function`) return structuredClone(e);
  try {
    return JSON.parse(JSON.stringify(e));
  } catch {
    return Array.isArray(e) ? [...e] : { ...e };
  }
};
function k() {
  return v4_default();
}
function A(e) {
  if (Object.freeze(e), typeof e == `object` && e) for (let t of Object.values(e)) typeof t == `object` && t && !Object.isFrozen(t) && A(t);
  return e;
}
var j = 512 * 1024;
function M(e, t, n) {
  let r = 0, i = [e, t], a2 = /* @__PURE__ */ new WeakSet();
  for (; i.length > 0; ) {
    let e2 = i.pop();
    if (typeof e2 == `string`) {
      if (r += e2.length, r > n) return true;
    } else if (typeof e2 == `object` && e2) {
      if (a2.has(e2)) continue;
      if (a2.add(e2), Array.isArray(e2)) for (let t2 = 0; t2 < e2.length; t2++) i.push(e2[t2]);
      else {
        let t2 = Object.keys(e2);
        for (let a3 = 0; a3 < t2.length; a3++) {
          let o2 = t2[a3];
          if (r += o2.length, r > n) return true;
          i.push(e2[o2]);
        }
      }
    }
  }
  return false;
}
async function N(e, t, n, r) {
  let i = typeof process < `u` && process.env !== void 0, a2 = i && (process.env.NODE_ENV === `test` || !!process.env.VITEST_WORKER_ID), o2 = i && (process.env.NODE_ENV === `development` || process.env.NODE_ENV === `test` || !!process.env.VITEST_WORKER_ID), s2 = o2 && !M(t, n, j), c2 = s2 ? O(t) : t, l2 = s2 ? O(n) : n, u2 = false, d2 = false, f2;
  for (let t2 of e) try {
    s2 && (A(c2), A(l2));
    let e2 = await r(t2, c2, l2);
    if (e2 === void 0) continue;
    let n2 = false;
    if (e2.messages !== void 0 && e2.messages !== c2 && (c2 = O(e2.messages), u2 = true, n2 = true), e2.state !== void 0 && e2.state !== l2 && (l2 = O(e2.state), d2 = true, n2 = true), s2 && n2 && M(c2, l2, j) && (s2 = false), f2 = e2.stopPropagation, f2 === true) break;
  } catch (e2) {
    if (o2 && e2 instanceof TypeError) {
      if (a2) throw e2;
      console.error(`AG-UI: Subscriber attempted to mutate frozen inputs in-place. Return mutations via AgentStateMutation instead of mutating directly.`, e2);
    } else a2 || console.error(`Subscriber error:`, e2);
    continue;
  }
  return { ...u2 ? { messages: Object.isFrozen(c2) ? O(c2) : c2 } : {}, ...d2 ? { state: Object.isFrozen(l2) ? O(l2) : l2 } : {}, ...f2 === void 0 ? {} : { stopPropagation: f2 } };
}
function P(e) {
  if (!e) return { enabled: false, events: false, lifecycle: false, verbose: false };
  if (e === true) return { enabled: true, events: true, lifecycle: true, verbose: true };
  let t = e.events ?? true, n = e.lifecycle ?? true, r = e.verbose ?? false;
  return { enabled: t || n, events: t, lifecycle: n, verbose: r };
}
function F(e) {
  if (e instanceof I) return e;
  if (e === true) return new I(P(true));
}
var I = class {
  constructor(e) {
    this.config = e;
  }
  event(e, t, n, r) {
    this.config.events && (this.config.verbose ? console.debug(`[${e}] ${t}`, typeof n == `string` ? n : JSON.stringify(n)) : console.debug(`[${e}] ${t}`, r ?? n));
  }
  lifecycle(e, t, n) {
    this.config.lifecycle && (n ? console.debug(`[${e}] ${t}`, n) : console.debug(`[${e}] ${t}`));
  }
  get eventsEnabled() {
    return this.config.events;
  }
  get lifecycleEnabled() {
    return this.config.lifecycle;
  }
  get enabled() {
    return this.config.enabled;
  }
};
function L(e) {
  return e.enabled ? new I(e) : void 0;
}
function ae(e, t, n) {
  if (t) {
    let r2 = e.find((e2) => e2.id === t);
    if (r2?.role === `assistant`) return r2;
    r2 && console.warn(`TOOL_CALL_START: parentMessageId '${t}' matches a '${r2.role}' message, not assistant \u2014 falling back to toolCallId`);
    let i = { id: r2 ? n : t, role: `assistant`, toolCalls: [] };
    return e.push(i), i;
  }
  let r = { id: n, role: `assistant`, toolCalls: [] };
  return e.push(r), r;
}
var R = (e, t, n, r, s2) => {
  let c2 = F(s2), l2 = O(n.messages), u2 = O(e.state), d2 = {}, f2 = (e2) => {
    e2.messages !== void 0 && (l2 = e2.messages, d2.messages = e2.messages), e2.state !== void 0 && (u2 = e2.state, d2.state = e2.state);
  }, p2 = () => {
    let e2 = O(d2);
    return d2 = {}, e2.messages !== void 0 || e2.state !== void 0 ? (0, import_rxjs.of)(e2) : import_rxjs.EMPTY;
  };
  return t.pipe((0, import_operators.concatMap)(async (t2) => {
    let o2 = await N(r, l2, u2, (r2, i, a2) => r2.onEvent?.({ event: t2, agent: n, input: e, messages: i, state: a2 }));
    if (f2(o2), o2.stopPropagation === true ? c2?.event(`APPLY`, `Event dropped:`, t2, { type: t2.type, reason: `stopPropagation by subscriber` }) : c2?.event(`APPLY`, `Event applied:`, t2, { type: t2.type, subscribers: r.length }), o2.stopPropagation === true) return p2();
    switch (t2.type) {
      case EventType.TEXT_MESSAGE_START: {
        let i = await N(r, l2, u2, (r2, i2, a2) => r2.onTextMessageStartEvent?.({ event: t2, messages: i2, state: a2, agent: n, input: e }));
        if (f2(i), i.stopPropagation !== true) {
          let { messageId: e2, role: n2 = `assistant`, name: r2 } = t2;
          if (!l2.find((t3) => t3.id === e2)) {
            let t3 = { id: e2, role: n2, content: ``, ...r2 !== void 0 && { name: r2 } };
            l2.push(t3), f2({ messages: l2 });
          }
        }
        return p2();
      }
      case EventType.TEXT_MESSAGE_CONTENT: {
        let { messageId: i, delta: a2 } = t2, o3 = l2.find((e2) => e2.id === i);
        if (!o3) return console.warn(`TEXT_MESSAGE_CONTENT: No message found with ID '${i}'`), p2();
        let s3 = await N(r, l2, u2, (r2, i2, a3) => r2.onTextMessageContentEvent?.({ event: t2, messages: i2, state: a3, agent: n, input: e, textMessageBuffer: typeof o3.content == `string` ? o3.content : `` }));
        return f2(s3), s3.stopPropagation !== true && (o3.content = `${typeof o3.content == `string` ? o3.content : ``}${a2}`, f2({ messages: l2 })), p2();
      }
      case EventType.TEXT_MESSAGE_END: {
        let { messageId: i } = t2, a2 = l2.find((e2) => e2.id === i);
        return a2 ? (f2(await N(r, l2, u2, (r2, i2, o3) => r2.onTextMessageEndEvent?.({ event: t2, messages: i2, state: o3, agent: n, input: e, textMessageBuffer: typeof a2.content == `string` ? a2.content : `` }))), await Promise.all(r.map((t3) => {
          t3.onNewMessage?.({ message: a2, messages: l2, state: u2, agent: n, input: e });
        })), p2()) : (console.warn(`TEXT_MESSAGE_END: No message found with ID '${i}'`), p2());
      }
      case EventType.TOOL_CALL_START: {
        let i = await N(r, l2, u2, (r2, i2, a2) => r2.onToolCallStartEvent?.({ event: t2, messages: i2, state: a2, agent: n, input: e }));
        if (f2(i), i.stopPropagation !== true) {
          let { toolCallId: e2, toolCallName: n2, parentMessageId: r2 } = t2, i2 = l2.find((t3) => t3.toolCalls?.some((t4) => t4.id === e2))?.toolCalls?.find((t3) => t3.id === e2);
          if (i2) return i2.function.name !== n2 && (console.warn(`TOOL_CALL_START: tool call '${e2}' already exists with name '${i2.function.name}' \u2014 updating it to '${n2}'`), i2.function.name = n2, f2({ messages: l2 })), p2();
          let a2 = ae(l2, r2, e2);
          a2.toolCalls ??= [], a2.toolCalls.push({ id: e2, type: `function`, function: { name: n2, arguments: `` } }), f2({ messages: l2 });
        }
        return p2();
      }
      case EventType.TOOL_CALL_ARGS: {
        let { toolCallId: i, delta: a2 } = t2, o3 = l2.find((e2) => e2.toolCalls?.some((e3) => e3.id === i));
        if (!o3) return console.warn(`TOOL_CALL_ARGS: No message found containing tool call with ID '${i}'`), p2();
        let s3 = o3.toolCalls?.find((e2) => e2.id === i);
        if (!s3) return console.warn(`TOOL_CALL_ARGS: No tool call found with ID '${i}'`), p2();
        let c3 = await N(r, l2, u2, (r2, i2, a3) => {
          let o4 = s3.function.arguments, c4 = s3.function.name, l3 = {};
          try {
            l3 = (0, import_untruncate_json.default)(o4);
          } catch {
          }
          return r2.onToolCallArgsEvent?.({ event: t2, messages: i2, state: a3, agent: n, input: e, toolCallBuffer: o4, toolCallName: c4, partialToolCallArgs: l3 });
        });
        return f2(c3), c3.stopPropagation !== true && (s3.function.arguments += a2, f2({ messages: l2 })), p2();
      }
      case EventType.TOOL_CALL_END: {
        let { toolCallId: i } = t2, a2 = l2.find((e2) => e2.toolCalls?.some((e3) => e3.id === i));
        if (!a2) return console.warn(`TOOL_CALL_END: No message found containing tool call with ID '${i}'`), p2();
        let o3 = a2.toolCalls?.find((e2) => e2.id === i);
        return o3 ? (f2(await N(r, l2, u2, (r2, i2, a3) => {
          let s3 = o3.function.arguments, c3 = o3.function.name, l3 = {};
          try {
            l3 = JSON.parse(s3);
          } catch {
          }
          return r2.onToolCallEndEvent?.({ event: t2, messages: i2, state: a3, agent: n, input: e, toolCallName: c3, toolCallArgs: l3 });
        })), await Promise.all(r.map((t3) => {
          t3.onNewToolCall?.({ toolCall: o3, messages: l2, state: u2, agent: n, input: e });
        })), p2()) : (console.warn(`TOOL_CALL_END: No tool call found with ID '${i}'`), p2());
      }
      case EventType.TOOL_CALL_RESULT: {
        let i = await N(r, l2, u2, (r2, i2, a2) => r2.onToolCallResultEvent?.({ event: t2, messages: i2, state: a2, agent: n, input: e }));
        if (f2(i), i.stopPropagation !== true) {
          let { messageId: i2, toolCallId: a2, content: o3, role: s3 } = t2, c3 = { id: i2, toolCallId: a2, role: s3 || `tool`, content: o3 }, d3 = l2.findIndex((e2) => e2.role === `assistant` && e2.toolCalls?.some((e3) => e3.id === a2));
          if (d3 === -1) l2.push(c3);
          else {
            let e2 = d3 + 1;
            for (; e2 < l2.length && l2[e2].role === `tool`; ) e2++;
            l2.splice(e2, 0, c3);
          }
          await Promise.all(r.map((t3) => {
            t3.onNewMessage?.({ message: c3, messages: l2, state: u2, agent: n, input: e });
          })), f2({ messages: l2 });
        }
        return p2();
      }
      case EventType.STATE_SNAPSHOT: {
        let i = await N(r, l2, u2, (r2, i2, a2) => r2.onStateSnapshotEvent?.({ event: t2, messages: i2, state: a2, agent: n, input: e }));
        if (f2(i), i.stopPropagation !== true) {
          let { snapshot: e2 } = t2;
          u2 = e2, f2({ state: u2 });
        }
        return p2();
      }
      case EventType.STATE_DELTA: {
        let i = await N(r, l2, u2, (r2, i2, a2) => r2.onStateDeltaEvent?.({ event: t2, messages: i2, state: a2, agent: n, input: e }));
        if (f2(i), i.stopPropagation !== true) {
          let { delta: e2 } = t2;
          try {
            u2 = import_fast_json_patch.default.applyPatch(u2, e2, true, false).newDocument, f2({ state: u2 });
          } catch (t3) {
            let n2 = t3 instanceof Error ? t3.message : String(t3);
            console.warn(`Failed to apply state patch:
Current state: ${JSON.stringify(u2, null, 2)}
Patch operations: ${JSON.stringify(e2, null, 2)}
Error: ${n2}`);
          }
        }
        return p2();
      }
      case EventType.MESSAGES_SNAPSHOT: {
        let i = await N(r, l2, u2, (r2, i2, a2) => r2.onMessagesSnapshotEvent?.({ event: t2, messages: i2, state: a2, agent: n, input: e }));
        if (f2(i), i.stopPropagation !== true) {
          let { messages: e2 } = t2, n2 = new Map(e2.map((e3) => [e3.id, e3])), r2 = e2.some((e3) => e3.role === `activity`), i2 = e2.some((e3) => e3.role === `reasoning`), a2 = (e3) => e3.role === `activity` && !r2 || e3.role === `reasoning` && !i2;
          l2 = l2.filter((e3) => a2(e3) || n2.has(e3.id)).map((e3) => a2(e3) ? e3 : n2.get(e3.id));
          let o3 = new Set(l2.map((e3) => e3.id));
          for (let t3 of e2) o3.has(t3.id) || l2.push(t3);
          f2({ messages: l2 });
        }
        return p2();
      }
      case EventType.ACTIVITY_SNAPSHOT: {
        let i = t2, a2 = l2.findIndex((e2) => e2.id === i.messageId), o3 = a2 >= 0 ? l2[a2] : void 0, s3 = o3?.role === `activity` ? o3 : void 0, c3 = i.replace ?? true, d3 = await N(r, l2, u2, (t3, r2, a3) => t3.onActivitySnapshotEvent?.({ event: i, messages: r2, state: a3, agent: n, input: e, activityMessage: s3, existingMessage: o3 }));
        if (f2(d3), d3.stopPropagation !== true) {
          let t3 = { id: i.messageId, role: `activity`, activityType: i.activityType, content: O(i.content) }, o4;
          a2 === -1 ? (l2.push(t3), o4 = t3) : s3 ? c3 && (l2[a2] = { ...s3, activityType: i.activityType, content: O(i.content) }) : c3 && (l2[a2] = t3, o4 = t3), f2({ messages: l2 }), o4 && await Promise.all(r.map((t4) => t4.onNewMessage?.({ message: o4, messages: l2, state: u2, agent: n, input: e })));
        }
        return p2();
      }
      case EventType.ACTIVITY_DELTA: {
        let i = t2, o3 = l2.findIndex((e2) => e2.id === i.messageId);
        if (o3 === -1) return p2();
        let s3 = l2[o3];
        if (s3.role !== `activity`) return console.warn(`ACTIVITY_DELTA: Message '${i.messageId}' is not an activity message`), p2();
        let c3 = s3, d3 = await N(r, l2, u2, (t3, r2, a2) => t3.onActivityDeltaEvent?.({ event: i, messages: r2, state: a2, agent: n, input: e, activityMessage: c3 }));
        if (f2(d3), d3.stopPropagation !== true) try {
          let e2 = O(c3.content ?? {}), t3 = import_fast_json_patch.default.applyPatch(e2, i.patch ?? [], true, false).newDocument;
          l2[o3] = { ...c3, content: O(t3), activityType: i.activityType }, f2({ messages: l2 });
        } catch (e2) {
          let t3 = e2 instanceof Error ? e2.message : String(e2);
          console.warn(`Failed to apply activity patch for '${i.messageId}': ${t3}`);
        }
        return p2();
      }
      case EventType.RAW:
        return f2(await N(r, l2, u2, (r2, i, a2) => r2.onRawEvent?.({ event: t2, messages: i, state: a2, agent: n, input: e }))), p2();
      case EventType.CUSTOM:
        return f2(await N(r, l2, u2, (r2, i, a2) => r2.onCustomEvent?.({ event: t2, messages: i, state: a2, agent: n, input: e }))), p2();
      case EventType.RUN_STARTED: {
        let i = await N(r, l2, u2, (r2, i2, a2) => r2.onRunStartedEvent?.({ event: t2, messages: i2, state: a2, agent: n, input: e }));
        if (f2(i), i.stopPropagation !== true) {
          let e2 = t2;
          if (e2.input?.messages) {
            for (let t3 of e2.input.messages) l2.find((e3) => e3.id === t3.id) || l2.push(t3);
            f2({ messages: l2 });
          }
        }
        return p2();
      }
      case EventType.RUN_FINISHED: {
        let i = t2, a2 = i.outcome?.type === `interrupt` ? { event: i, outcome: `interrupt`, interrupts: i.outcome.interrupts } : { event: i, outcome: `success`, result: i.result }, o3 = await N(r, l2, u2, (t3, r2, i2) => t3.onRunFinishedEvent?.({ ...a2, messages: r2, state: i2, agent: n, input: e }));
        return f2(o3), o3.stopPropagation !== true && (n.pendingInterrupts = a2.outcome === `interrupt` ? [...a2.interrupts] : []), p2();
      }
      case EventType.RUN_ERROR:
        return f2(await N(r, l2, u2, (r2, i, a2) => r2.onRunErrorEvent?.({ event: t2, messages: i, state: a2, agent: n, input: e }))), p2();
      case EventType.STEP_STARTED:
        return f2(await N(r, l2, u2, (r2, i, a2) => r2.onStepStartedEvent?.({ event: t2, messages: i, state: a2, agent: n, input: e }))), p2();
      case EventType.STEP_FINISHED:
        return f2(await N(r, l2, u2, (r2, i, a2) => r2.onStepFinishedEvent?.({ event: t2, messages: i, state: a2, agent: n, input: e }))), p2();
      case EventType.TEXT_MESSAGE_CHUNK:
        throw Error(`TEXT_MESSAGE_CHUNK must be tranformed before being applied`);
      case EventType.TOOL_CALL_CHUNK:
        throw Error(`TOOL_CALL_CHUNK must be tranformed before being applied`);
      case EventType.THINKING_START:
        return p2();
      case EventType.THINKING_END:
        return p2();
      case EventType.THINKING_TEXT_MESSAGE_START:
        return p2();
      case EventType.THINKING_TEXT_MESSAGE_CONTENT:
        return p2();
      case EventType.THINKING_TEXT_MESSAGE_END:
        return p2();
      case EventType.REASONING_START:
        return f2(await N(r, l2, u2, (r2, i, a2) => r2.onReasoningStartEvent?.({ event: t2, messages: i, state: a2, agent: n, input: e }))), p2();
      case EventType.REASONING_MESSAGE_START: {
        let i = await N(r, l2, u2, (r2, i2, a2) => r2.onReasoningMessageStartEvent?.({ event: t2, messages: i2, state: a2, agent: n, input: e }));
        if (f2(i), i.stopPropagation !== true) {
          let { messageId: e2 } = t2;
          if (!l2.find((t3) => t3.id === e2)) {
            let t3 = { id: e2, role: `reasoning`, content: `` };
            l2.push(t3), f2({ messages: l2 });
          }
        }
        return p2();
      }
      case EventType.REASONING_MESSAGE_CONTENT: {
        let { messageId: i, delta: a2 } = t2, o3 = l2.find((e2) => e2.id === i);
        if (!o3) return console.warn(`REASONING_MESSAGE_CONTENT: No message found with ID '${i}'`), p2();
        let s3 = await N(r, l2, u2, (r2, i2, a3) => r2.onReasoningMessageContentEvent?.({ event: t2, messages: i2, state: a3, agent: n, input: e, reasoningMessageBuffer: typeof o3.content == `string` ? o3.content : `` }));
        return f2(s3), s3.stopPropagation !== true && (o3.content = `${typeof o3.content == `string` ? o3.content : ``}${a2}`, f2({ messages: l2 })), p2();
      }
      case EventType.REASONING_MESSAGE_END: {
        let { messageId: i } = t2, a2 = l2.find((e2) => e2.id === i);
        return a2 ? (f2(await N(r, l2, u2, (r2, i2, o3) => r2.onReasoningMessageEndEvent?.({ event: t2, messages: i2, state: o3, agent: n, input: e, reasoningMessageBuffer: typeof a2.content == `string` ? a2.content : `` }))), await Promise.all(r.map((t3) => {
          t3.onNewMessage?.({ message: a2, messages: l2, state: u2, agent: n, input: e });
        })), p2()) : (console.warn(`REASONING_MESSAGE_END: No message found with ID '${i}'`), p2());
      }
      case EventType.REASONING_MESSAGE_CHUNK:
        throw Error(`REASONING_MESSAGE_CHUNK must be transformed before being applied`);
      case EventType.REASONING_END:
        return f2(await N(r, l2, u2, (r2, i, a2) => r2.onReasoningEndEvent?.({ event: t2, messages: i, state: a2, agent: n, input: e }))), p2();
      case EventType.REASONING_ENCRYPTED_VALUE: {
        let { subtype: i, entityId: a2, encryptedValue: o3 } = t2, s3 = await N(r, l2, u2, (r2, i2, a3) => r2.onReasoningEncryptedValueEvent?.({ event: t2, messages: i2, state: a3, agent: n, input: e }));
        if (f2(s3), s3.stopPropagation !== true) {
          let e2 = false;
          if (i === `tool-call`) {
            for (let t3 of l2) if (t3.role === `assistant` && t3.toolCalls) {
              let n2 = t3.toolCalls.find((e3) => e3.id === a2);
              if (n2) {
                n2.encryptedValue = o3, e2 = true;
                break;
              }
            }
          } else {
            let t3 = l2.find((e3) => e3.id === a2);
            t3?.role !== `activity` && t3 && (t3.encryptedValue = o3, e2 = true);
          }
          e2 && (d2.messages = l2);
        }
        return p2();
      }
    }
    return t2.type, p2();
  }), (0, import_operators.mergeAll)(), r.length > 0 ? (0, import_operators.defaultIfEmpty)({}) : (e2) => e2);
};
var z = (e) => (t) => {
  let r = F(e), a2 = /* @__PURE__ */ new Map(), o2 = /* @__PURE__ */ new Map(), s2 = false, c2 = false, l2 = false, u2 = /* @__PURE__ */ new Map(), d2 = false, f2 = false, p2 = false, m2 = () => {
    a2.clear(), o2.clear(), u2.clear(), d2 = false, f2 = false, s2 = false, c2 = false, p2 = true;
  };
  return t.pipe((0, import_operators.mergeMap)((e2) => {
    let t2 = e2.type;
    if (r?.event(`VERIFY`, `Event:`, e2, { type: e2.type }), c2) return (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send event type '${t2}': The run has already errored with 'RUN_ERROR'. No further events can be sent.`));
    if (s2 && t2 !== EventType.RUN_ERROR && t2 !== EventType.RUN_STARTED) return (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send event type '${t2}': The run has already finished with 'RUN_FINISHED'. Start a new run with 'RUN_STARTED'.`));
    if (!l2) {
      if (l2 = true, t2 !== EventType.RUN_STARTED && t2 !== EventType.RUN_ERROR) return (0, import_rxjs.throwError)(() => new AGUIError(`First event must be 'RUN_STARTED'`));
    } else if (t2 === EventType.RUN_STARTED) {
      if (p2 && !s2) return (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send 'RUN_STARTED' while a run is still active. The previous run must be finished with 'RUN_FINISHED' before starting a new run.`));
      s2 && m2();
    }
    switch (t2) {
      case EventType.TEXT_MESSAGE_START: {
        let t3 = e2.messageId;
        return a2.has(t3) ? (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send 'TEXT_MESSAGE_START' event: A text message with ID '${t3}' is already in progress. Complete it with 'TEXT_MESSAGE_END' first.`)) : (a2.set(t3, true), (0, import_rxjs.of)(e2));
      }
      case EventType.TEXT_MESSAGE_CONTENT: {
        let t3 = e2.messageId;
        return a2.has(t3) ? (0, import_rxjs.of)(e2) : (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send 'TEXT_MESSAGE_CONTENT' event: No active text message found with ID '${t3}'. Start a text message with 'TEXT_MESSAGE_START' first.`));
      }
      case EventType.TEXT_MESSAGE_END: {
        let t3 = e2.messageId;
        return a2.has(t3) ? (a2.delete(t3), (0, import_rxjs.of)(e2)) : (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send 'TEXT_MESSAGE_END' event: No active text message found with ID '${t3}'. A 'TEXT_MESSAGE_START' event must be sent first.`));
      }
      case EventType.TOOL_CALL_START: {
        let t3 = e2.toolCallId;
        return o2.has(t3) ? (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send 'TOOL_CALL_START' event: A tool call with ID '${t3}' is already in progress. Complete it with 'TOOL_CALL_END' first.`)) : (o2.set(t3, true), (0, import_rxjs.of)(e2));
      }
      case EventType.TOOL_CALL_ARGS: {
        let t3 = e2.toolCallId;
        return o2.has(t3) ? (0, import_rxjs.of)(e2) : (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send 'TOOL_CALL_ARGS' event: No active tool call found with ID '${t3}'. Start a tool call with 'TOOL_CALL_START' first.`));
      }
      case EventType.TOOL_CALL_END: {
        let t3 = e2.toolCallId;
        return o2.has(t3) ? (o2.delete(t3), (0, import_rxjs.of)(e2)) : (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send 'TOOL_CALL_END' event: No active tool call found with ID '${t3}'. A 'TOOL_CALL_START' event must be sent first.`));
      }
      case EventType.STEP_STARTED: {
        let t3 = e2.stepName;
        return u2.has(t3) ? (0, import_rxjs.throwError)(() => new AGUIError(`Step "${t3}" is already active for 'STEP_STARTED'`)) : (u2.set(t3, true), (0, import_rxjs.of)(e2));
      }
      case EventType.STEP_FINISHED: {
        let t3 = e2.stepName;
        return u2.has(t3) ? (u2.delete(t3), (0, import_rxjs.of)(e2)) : (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send 'STEP_FINISHED' for step "${t3}" that was not started`));
      }
      case EventType.RUN_STARTED:
        return p2 = true, (0, import_rxjs.of)(e2);
      case EventType.RUN_FINISHED:
        if (u2.size > 0) {
          let e3 = Array.from(u2.keys()).join(`, `);
          return (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send 'RUN_FINISHED' while steps are still active: ${e3}`));
        }
        if (a2.size > 0) {
          let e3 = Array.from(a2.keys()).join(`, `);
          return (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send 'RUN_FINISHED' while text messages are still active: ${e3}`));
        }
        if (o2.size > 0) {
          let e3 = Array.from(o2.keys()).join(`, `);
          return (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send 'RUN_FINISHED' while tool calls are still active: ${e3}`));
        }
        return s2 = true, (0, import_rxjs.of)(e2);
      case EventType.RUN_ERROR:
        return c2 = true, (0, import_rxjs.of)(e2);
      case EventType.CUSTOM:
        return (0, import_rxjs.of)(e2);
      case EventType.THINKING_TEXT_MESSAGE_START:
        return d2 ? f2 ? (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send 'THINKING_TEXT_MESSAGE_START' event: A thinking message is already in progress. Complete it with 'THINKING_TEXT_MESSAGE_END' first.`)) : (f2 = true, (0, import_rxjs.of)(e2)) : (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send 'THINKING_TEXT_MESSAGE_START' event: A thinking step is not in progress. Create one with 'THINKING_START' first.`));
      case EventType.THINKING_TEXT_MESSAGE_CONTENT:
        return f2 ? (0, import_rxjs.of)(e2) : (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send 'THINKING_TEXT_MESSAGE_CONTENT' event: No active thinking message found. Start a message with 'THINKING_TEXT_MESSAGE_START' first.`));
      case EventType.THINKING_TEXT_MESSAGE_END:
        return f2 ? (f2 = false, (0, import_rxjs.of)(e2)) : (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send 'THINKING_TEXT_MESSAGE_END' event: No active thinking message found. A 'THINKING_TEXT_MESSAGE_START' event must be sent first.`));
      case EventType.THINKING_START:
        return d2 ? (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send 'THINKING_START' event: A thinking step is already in progress. End it with 'THINKING_END' first.`)) : (d2 = true, (0, import_rxjs.of)(e2));
      case EventType.THINKING_END:
        return d2 ? (d2 = false, (0, import_rxjs.of)(e2)) : (0, import_rxjs.throwError)(() => new AGUIError(`Cannot send 'THINKING_END' event: No active thinking step found. A 'THINKING_START' event must be sent first.`));
      default:
        return (0, import_rxjs.of)(e2);
    }
  }));
};
var B = (function(e) {
  return e.HEADERS = `headers`, e.DATA = `data`, e;
})({});
var V = (e) => (0, import_rxjs.defer)(() => (0, import_rxjs.from)(e())).pipe((0, import_operators.switchMap)((e2) => {
  if (!e2.ok) {
    let t2 = e2.headers.get(`content-type`) || ``;
    return (0, import_rxjs.from)(e2.text()).pipe((0, import_operators.mergeMap)((n2) => {
      let r = n2;
      if (t2.includes(`application/json`)) try {
        r = JSON.parse(n2);
      } catch {
      }
      let i = Error(`HTTP ${e2.status}: ${typeof r == `string` ? r : JSON.stringify(r)}`);
      return i.status = e2.status, i.payload = r, (0, import_rxjs.throwError)(() => i);
    }));
  }
  let t = { type: B.HEADERS, status: e2.status, headers: e2.headers }, n = e2.body?.getReader();
  return n ? new import_rxjs.Observable((e3) => (e3.next(t), (async () => {
    try {
      for (; ; ) {
        let { done: t2, value: r } = await n.read();
        if (t2) break;
        let i = { type: B.DATA, data: r };
        e3.next(i);
      }
      e3.complete();
    } catch (t2) {
      e3.error(t2);
    }
  })(), () => {
    n.cancel().catch((e4) => {
      if (e4?.name !== `AbortError`) throw e4;
    });
  })) : (0, import_rxjs.throwError)(() => Error(`Failed to getReader() from response`));
}));
var H = (e, t) => {
  let n = F(t), r = new import_rxjs.Subject(), i = new TextDecoder(`utf-8`, { fatal: false }), a2 = ``;
  e.subscribe({ next: (e2) => {
    if (e2.type !== B.HEADERS && e2.type === B.DATA && e2.data) {
      let t2 = i.decode(e2.data, { stream: true });
      a2 += t2;
      let n2 = a2.split(/\n\n/);
      a2 = n2.pop() || ``;
      for (let e3 of n2) o2(e3);
    }
  }, error: (e2) => r.error(e2), complete: () => {
    a2 && (a2 += i.decode(), o2(a2)), r.complete();
  } });
  function o2(e2) {
    let t2 = e2.split(`
`), i2 = [];
    for (let e3 of t2) e3.startsWith(`data:`) && i2.push(e3.slice(5).replace(/^ /, ``));
    if (i2.length > 0) try {
      let e3 = i2.join(`
`), t3 = JSON.parse(e3);
      n?.event(`SSE`, `Event received:`, t3, { type: t3.type }), r.next(t3);
    } catch (e3) {
      r.error(e3);
    }
  }
  return r.asObservable();
};
var U = (e) => {
  let t = new import_rxjs.Subject(), n = new Uint8Array();
  e.subscribe({ next: (e2) => {
    if (e2.type !== B.HEADERS && e2.type === B.DATA && e2.data) {
      let t2 = new Uint8Array(n.length + e2.data.length);
      t2.set(n, 0), t2.set(e2.data, n.length), n = t2, r();
    }
  }, error: (e2) => t.error(e2), complete: () => {
    if (n.length > 0) try {
      r();
    } catch {
      console.warn(`Incomplete or invalid protocol buffer data at stream end`);
    }
    t.complete();
  } });
  function r() {
    for (; n.length >= 4; ) {
      let e2 = 4 + new DataView(n.buffer, n.byteOffset, 4).getUint32(0, false);
      if (n.length < e2) break;
      try {
        let r2 = n.slice(4, e2), i = decode(r2);
        t.next(i), n = n.slice(e2);
      } catch (e3) {
        let n2 = e3 instanceof Error ? e3.message : String(e3);
        t.error(Error(`Failed to decode protocol buffer message: ${n2}`));
        return;
      }
    }
  }
  return t.asObservable();
};
var W = (e, t) => {
  let n = F(t), a2 = new import_rxjs.Subject(), o2 = new import_rxjs.ReplaySubject(), s2 = false;
  return e.subscribe({ next: (e2) => {
    if (o2.next(e2), e2.type === B.HEADERS && !s2) {
      s2 = true;
      let t2 = e2.headers.get(`content-type`);
      n?.lifecycle(`HTTP`, `Stream format detected:`, { contentType: t2, parser: t2 === AGUI_MEDIA_TYPE ? `protobuf` : `sse` }), t2 === AGUI_MEDIA_TYPE ? U(o2).subscribe({ next: (e3) => a2.next(e3), error: (e3) => a2.error(e3), complete: () => a2.complete() }) : H(o2, n).subscribe({ next: (e3) => {
        try {
          let t3 = EventSchemas.parse(e3);
          n?.event(`HTTP`, `Event validated:`, t3, { type: t3.type, valid: true }), a2.next(t3);
        } catch (t3) {
          n?.event(`HTTP`, `Event invalid:`, { json: e3, error: String(t3) }), a2.error(t3);
        }
      }, error: (e3) => {
        if (e3?.name === `AbortError`) {
          a2.next({ type: EventType.RUN_ERROR, message: e3.message || `Request aborted`, code: `abort`, rawEvent: e3 }), a2.complete();
          return;
        }
        return a2.error(e3);
      }, complete: () => a2.complete() });
    } else s2 || a2.error(Error(`No headers event received before data events`));
  }, error: (e2) => {
    o2.error(e2), a2.error(e2);
  }, complete: () => {
    o2.complete();
  } }), a2.asObservable();
};
var G = external_exports.enum([`TextMessageStart`, `TextMessageContent`, `TextMessageEnd`, `ActionExecutionStart`, `ActionExecutionArgs`, `ActionExecutionEnd`, `ActionExecutionResult`, `AgentStateMessage`, `MetaEvent`, `RunStarted`, `RunFinished`, `RunError`, `NodeStarted`, `NodeFinished`]);
var oe = external_exports.enum([`LangGraphInterruptEvent`, `PredictState`, `Exit`]);
var se = external_exports.object({ type: external_exports.literal(G.enum.TextMessageStart), messageId: external_exports.string(), parentMessageId: external_exports.string().optional(), role: external_exports.string().optional() });
var ce = external_exports.object({ type: external_exports.literal(G.enum.TextMessageContent), messageId: external_exports.string(), content: external_exports.string() });
var le = external_exports.object({ type: external_exports.literal(G.enum.TextMessageEnd), messageId: external_exports.string() });
var ue = external_exports.object({ type: external_exports.literal(G.enum.ActionExecutionStart), actionExecutionId: external_exports.string(), actionName: external_exports.string(), parentMessageId: external_exports.string().optional() });
var de = external_exports.object({ type: external_exports.literal(G.enum.ActionExecutionArgs), actionExecutionId: external_exports.string(), args: external_exports.string() });
var fe = external_exports.object({ type: external_exports.literal(G.enum.ActionExecutionEnd), actionExecutionId: external_exports.string() });
var pe = external_exports.object({ type: external_exports.literal(G.enum.ActionExecutionResult), actionName: external_exports.string(), actionExecutionId: external_exports.string(), result: external_exports.string() });
var me = external_exports.object({ type: external_exports.literal(G.enum.AgentStateMessage), threadId: external_exports.string(), agentName: external_exports.string(), nodeName: external_exports.string(), runId: external_exports.string(), active: external_exports.boolean(), role: external_exports.string(), state: external_exports.string(), running: external_exports.boolean() });
var he = external_exports.object({ type: external_exports.literal(G.enum.MetaEvent), name: oe, value: external_exports.any() });
var ge = external_exports.object({ type: external_exports.literal(G.enum.RunError), message: external_exports.string(), code: external_exports.string().optional() });
external_exports.discriminatedUnion(`type`, [se, ce, le, ue, de, fe, pe, me, he, ge]), external_exports.object({ id: external_exports.string(), role: external_exports.string(), content: external_exports.string(), parentMessageId: external_exports.string().optional() }), external_exports.object({ id: external_exports.string(), name: external_exports.string(), arguments: external_exports.any(), parentMessageId: external_exports.string().optional() }), external_exports.object({ id: external_exports.string(), result: external_exports.any(), actionExecutionId: external_exports.string(), actionName: external_exports.string() });
var _e = (e) => {
  if (typeof e == `string`) return e;
  if (!Array.isArray(e)) return;
  let t = e.filter((e2) => e2.type === `text`).map((e2) => e2.text).filter((e2) => e2.length > 0);
  if (t.length !== 0) return t.join(`
`);
};
var K = (e, t, n) => (r) => {
  let o2 = {}, s2 = true, c2 = true, l2 = ``, u2 = null, d2 = null, f2 = [], p2 = {}, m2 = (e2) => {
    typeof e2 == `object` && e2 && (`messages` in e2 && delete e2.messages, o2 = e2);
  };
  return r.pipe((0, import_operators.mergeMap)((r2) => {
    switch (r2.type) {
      case EventType.TEXT_MESSAGE_START: {
        let e2 = r2;
        return [{ type: G.enum.TextMessageStart, messageId: e2.messageId, role: e2.role }];
      }
      case EventType.TEXT_MESSAGE_CONTENT: {
        let e2 = r2;
        return [{ type: G.enum.TextMessageContent, messageId: e2.messageId, content: e2.delta }];
      }
      case EventType.TEXT_MESSAGE_END: {
        let e2 = r2;
        return [{ type: G.enum.TextMessageEnd, messageId: e2.messageId }];
      }
      case EventType.TOOL_CALL_START: {
        let e2 = r2;
        return f2.push({ id: e2.toolCallId, type: `function`, function: { name: e2.toolCallName, arguments: `` } }), c2 = true, p2[e2.toolCallId] = e2.toolCallName, [{ type: G.enum.ActionExecutionStart, actionExecutionId: e2.toolCallId, actionName: e2.toolCallName, parentMessageId: e2.parentMessageId }];
      }
      case EventType.TOOL_CALL_ARGS: {
        let i = r2, a2 = f2.find((e2) => e2.id === i.toolCallId);
        if (!a2) return console.warn(`TOOL_CALL_ARGS: No tool call found with ID '${i.toolCallId}'`), [];
        a2.function.arguments += i.delta;
        let u3 = false;
        if (d2) {
          let e2 = d2.find((e3) => e3.tool == a2.function.name);
          if (e2) try {
            let t2 = JSON.parse((0, import_untruncate_json.default)(a2.function.arguments));
            e2.tool_argument && e2.tool_argument in t2 ? (m2({ ...o2, [e2.state_key]: t2[e2.tool_argument] }), u3 = true) : e2.tool_argument || (m2({ ...o2, [e2.state_key]: t2 }), u3 = true);
          } catch {
          }
        }
        return [{ type: G.enum.ActionExecutionArgs, actionExecutionId: i.toolCallId, args: i.delta }, ...u3 ? [{ type: G.enum.AgentStateMessage, threadId: e, agentName: n, nodeName: l2, runId: t, running: s2, role: `assistant`, state: JSON.stringify(o2), active: c2 }] : []];
      }
      case EventType.TOOL_CALL_END: {
        let e2 = r2;
        return [{ type: G.enum.ActionExecutionEnd, actionExecutionId: e2.toolCallId }];
      }
      case EventType.TOOL_CALL_RESULT: {
        let e2 = r2;
        return [{ type: G.enum.ActionExecutionResult, actionExecutionId: e2.toolCallId, result: e2.content, actionName: p2[e2.toolCallId] || `unknown` }];
      }
      case EventType.RAW:
        return [];
      case EventType.CUSTOM: {
        let e2 = r2;
        switch (e2.name) {
          case `Exit`:
            s2 = false;
            break;
          case `PredictState`:
            d2 = e2.value;
            break;
        }
        return [{ type: G.enum.MetaEvent, name: e2.name, value: e2.value }];
      }
      case EventType.STATE_SNAPSHOT:
        return m2(r2.snapshot), [{ type: G.enum.AgentStateMessage, threadId: e, agentName: n, nodeName: l2, runId: t, running: s2, role: `assistant`, state: JSON.stringify(o2), active: c2 }];
      case EventType.STATE_DELTA: {
        let i = r2, u3 = import_fast_json_patch.default.applyPatch(o2, i.delta, true, false);
        return u3 ? (m2(u3.newDocument), [{ type: G.enum.AgentStateMessage, threadId: e, agentName: n, nodeName: l2, runId: t, running: s2, role: `assistant`, state: JSON.stringify(o2), active: c2 }]) : [];
      }
      case EventType.MESSAGES_SNAPSHOT:
        return u2 = r2.messages, [{ type: G.enum.AgentStateMessage, threadId: e, agentName: n, nodeName: l2, runId: t, running: s2, role: `assistant`, state: JSON.stringify({ ...o2, ...u2 ? { messages: u2 } : {} }), active: true }];
      case EventType.RUN_STARTED:
        return [];
      case EventType.RUN_FINISHED:
        return u2 && (o2.messages = u2), Object.keys(o2).length === 0 ? [] : [{ type: G.enum.AgentStateMessage, threadId: e, agentName: n, nodeName: l2, runId: t, running: s2, role: `assistant`, state: JSON.stringify({ ...o2, ...u2 ? { messages: ve(u2) } : {} }), active: false }];
      case EventType.RUN_ERROR: {
        let e2 = r2;
        return [{ type: G.enum.RunError, message: e2.message, code: e2.code }];
      }
      case EventType.STEP_STARTED:
        return l2 = r2.stepName, f2 = [], d2 = null, [{ type: G.enum.AgentStateMessage, threadId: e, agentName: n, nodeName: l2, runId: t, running: s2, role: `assistant`, state: JSON.stringify(o2), active: true }];
      case EventType.STEP_FINISHED:
        return f2 = [], d2 = null, [{ type: G.enum.AgentStateMessage, threadId: e, agentName: n, nodeName: l2, runId: t, running: s2, role: `assistant`, state: JSON.stringify(o2), active: false }];
      default:
        return [];
    }
  }));
};
function ve(e) {
  let t = [];
  for (let n of e) if (n.role === `assistant` || n.role === `user` || n.role === `system`) {
    let e2 = _e(n.content);
    if (e2) {
      let r = { id: n.id, role: n.role, content: e2 };
      t.push(r);
    }
    if (n.role === `assistant` && n.toolCalls && n.toolCalls.length > 0) for (let e3 of n.toolCalls) {
      let r = { id: e3.id, name: e3.function.name, arguments: JSON.parse(e3.function.arguments), parentMessageId: n.id };
      t.push(r);
    }
  } else if (n.role === `tool`) {
    let r = `unknown`;
    for (let t2 of e) if (t2.role === `assistant` && t2.toolCalls?.length) {
      for (let e2 of t2.toolCalls) if (e2.id === n.toolCallId) {
        r = e2.function.name;
        break;
      }
    }
    let i = { id: n.id, result: n.content, actionExecutionId: n.toolCallId, actionName: r };
    t.push(i);
  }
  return t;
}
var q = (e) => (t) => {
  let n = F(e), r, a2, o2, s2, c2 = () => {
    if (!r || s2 !== `text`) throw Error(`No text message to close`);
    let e2 = { type: EventType.TEXT_MESSAGE_END, messageId: r.messageId };
    return s2 = void 0, r = void 0, n?.event(`TRANSFORM`, `TEXT_MESSAGE_END`, e2, { messageId: e2.messageId }), e2;
  }, l2 = () => {
    if (!a2 || s2 !== `tool`) throw Error(`No tool call to close`);
    let e2 = { type: EventType.TOOL_CALL_END, toolCallId: a2.toolCallId };
    return s2 = void 0, a2 = void 0, n?.event(`TRANSFORM`, `TOOL_CALL_END`, e2, { toolCallId: e2.toolCallId }), e2;
  }, u2 = () => {
    if (!o2 || s2 !== `reasoning`) throw Error(`No reasoning message to close`);
    let e2 = { type: EventType.REASONING_MESSAGE_END, messageId: o2.messageId };
    return s2 = void 0, o2 = void 0, n?.event(`TRANSFORM`, `REASONING_MESSAGE_END`, e2, { messageId: e2.messageId }), e2;
  }, f2 = () => s2 === `text` ? [c2()] : s2 === `tool` ? [l2()] : s2 === `reasoning` ? [u2()] : [];
  return t.pipe((0, import_rxjs.mergeMap)((e2) => {
    switch (e2.type) {
      case EventType.TEXT_MESSAGE_START:
      case EventType.TEXT_MESSAGE_CONTENT:
      case EventType.TEXT_MESSAGE_END:
      case EventType.TOOL_CALL_START:
      case EventType.TOOL_CALL_ARGS:
      case EventType.TOOL_CALL_END:
      case EventType.TOOL_CALL_RESULT:
      case EventType.STATE_SNAPSHOT:
      case EventType.STATE_DELTA:
      case EventType.MESSAGES_SNAPSHOT:
      case EventType.CUSTOM:
      case EventType.RUN_STARTED:
      case EventType.RUN_FINISHED:
      case EventType.RUN_ERROR:
      case EventType.STEP_STARTED:
      case EventType.STEP_FINISHED:
      case EventType.THINKING_START:
      case EventType.THINKING_END:
      case EventType.THINKING_TEXT_MESSAGE_START:
      case EventType.THINKING_TEXT_MESSAGE_CONTENT:
      case EventType.THINKING_TEXT_MESSAGE_END:
      case EventType.REASONING_START:
      case EventType.REASONING_MESSAGE_START:
      case EventType.REASONING_MESSAGE_CONTENT:
      case EventType.REASONING_MESSAGE_END:
      case EventType.REASONING_END:
        return [...f2(), e2];
      case EventType.RAW:
      case EventType.ACTIVITY_SNAPSHOT:
      case EventType.ACTIVITY_DELTA:
      case EventType.REASONING_ENCRYPTED_VALUE:
        return [e2];
      case EventType.TEXT_MESSAGE_CHUNK: {
        let t2 = e2, a3 = [];
        if ((s2 !== `text` || t2.messageId !== void 0 && t2.messageId !== r?.messageId) && a3.push(...f2()), s2 !== `text`) {
          if (t2.messageId === void 0) throw Error(`First TEXT_MESSAGE_CHUNK must have a messageId`);
          r = { messageId: t2.messageId, name: t2.name }, s2 = `text`;
          let e3 = { type: EventType.TEXT_MESSAGE_START, messageId: t2.messageId, role: t2.role || `assistant`, ...t2.name !== void 0 && { name: t2.name } };
          a3.push(e3), n?.event(`TRANSFORM`, `TEXT_MESSAGE_START`, e3, { messageId: t2.messageId });
        }
        if (t2.delta !== void 0) {
          let e3 = { type: EventType.TEXT_MESSAGE_CONTENT, messageId: r.messageId, delta: t2.delta };
          a3.push(e3), n?.event(`TRANSFORM`, `TEXT_MESSAGE_CONTENT`, e3, { messageId: r.messageId });
        }
        return a3;
      }
      case EventType.TOOL_CALL_CHUNK: {
        let t2 = e2, r2 = [];
        if ((s2 !== `tool` || t2.toolCallId !== void 0 && t2.toolCallId !== a2?.toolCallId) && r2.push(...f2()), s2 !== `tool`) {
          if (t2.toolCallId === void 0) throw Error(`First TOOL_CALL_CHUNK must have a toolCallId`);
          if (t2.toolCallName === void 0) throw Error(`First TOOL_CALL_CHUNK must have a toolCallName`);
          a2 = { toolCallId: t2.toolCallId, toolCallName: t2.toolCallName, parentMessageId: t2.parentMessageId }, s2 = `tool`;
          let e3 = { type: EventType.TOOL_CALL_START, toolCallId: t2.toolCallId, toolCallName: t2.toolCallName, parentMessageId: t2.parentMessageId };
          r2.push(e3), n?.event(`TRANSFORM`, `TOOL_CALL_START`, e3, { toolCallId: t2.toolCallId, toolCallName: t2.toolCallName });
        }
        if (t2.delta !== void 0) {
          let e3 = { type: EventType.TOOL_CALL_ARGS, toolCallId: a2.toolCallId, delta: t2.delta };
          r2.push(e3), n?.event(`TRANSFORM`, `TOOL_CALL_ARGS`, e3, { toolCallId: a2.toolCallId });
        }
        return r2;
      }
      case EventType.REASONING_MESSAGE_CHUNK: {
        let t2 = e2, r2 = [];
        if ((s2 !== `reasoning` || t2.messageId && t2.messageId !== o2?.messageId) && r2.push(...f2()), s2 !== `reasoning`) {
          if (t2.messageId === void 0) throw Error(`First REASONING_MESSAGE_CHUNK must have a messageId`);
          o2 = { messageId: t2.messageId }, s2 = `reasoning`;
          let e3 = { type: EventType.REASONING_MESSAGE_START, messageId: t2.messageId };
          r2.push(e3), n?.event(`TRANSFORM`, `REASONING_MESSAGE_START`, e3, { messageId: t2.messageId });
        }
        if (t2.delta !== void 0) {
          let e3 = { type: EventType.REASONING_MESSAGE_CONTENT, messageId: o2.messageId, delta: t2.delta };
          r2.push(e3), n?.event(`TRANSFORM`, `REASONING_MESSAGE_CONTENT`, e3, { messageId: o2.messageId });
        }
        return r2;
      }
    }
    return e2.type, [];
  }), (0, import_rxjs.finalize)(() => {
    f2();
  }));
};
function J(e, t = /* @__PURE__ */ new Date()) {
  return e.expiresAt === void 0 ? false : new Date(e.expiresAt) <= t;
}
var Y = class {
  runNext(e, t) {
    return t.run(e).pipe(q(false));
  }
  runNextWithState(e, t) {
    let n = O(e.messages || []), r = O(e.state || {}), i = new import_rxjs.ReplaySubject();
    return R(e, i, t, []).subscribe((e2) => {
      e2.messages !== void 0 && (n = e2.messages), e2.state !== void 0 && (r = e2.state);
    }), this.runNext(e, t).pipe((0, import_operators.concatMap)(async (e2) => (i.next(e2), await new Promise((e3) => setTimeout(e3, 0)), { event: e2, messages: O(n), state: O(r) })));
  }
};
var X = class extends Y {
  constructor(e) {
    super(), this.fn = e;
  }
  run(e, t) {
    return this.fn(e, t);
  }
};
function Se(e) {
  let t = e.content;
  if (Array.isArray(t)) {
    let n = t.filter((e2) => typeof e2 == `object` && !!e2 && `type` in e2 && e2.type === `text` && typeof e2.text == `string`).map((e2) => e2.text).join(``);
    return { ...e, content: n };
  }
  return typeof t == `string` ? e : { ...e, content: `` };
}
var Z = class extends Y {
  run(e, t) {
    let { parentRunId: n, ...r } = e, i = { ...r, messages: r.messages.map(Se) };
    return this.runNext(i, t);
  }
};
var Q = `THINKING_START`;
var Ce = `THINKING_END`;
var we = `THINKING_TEXT_MESSAGE_START`;
var Te = `THINKING_TEXT_MESSAGE_CONTENT`;
var Ee = `THINKING_TEXT_MESSAGE_END`;
var De = class extends Y {
  constructor(...e) {
    super(...e), this.currentReasoningId = null, this.currentMessageId = null;
  }
  warnAboutTransformation(e, t) {
    typeof process < `u` && process.env !== void 0 && process.env.SUPPRESS_TRANSFORMATION_WARNINGS || console.warn(`AG-UI is converting ${e} to ${t}. To remove this warning, upgrade your AG-UI integration package (e.g. @ag-ui/langgraph). To surpress it, set SUPPRESS_TRANSFORMATION_WARNINGS=true in your .env file.`);
  }
  run(e, t) {
    return this.currentReasoningId = null, this.currentMessageId = null, this.runNext(e, t).pipe((0, import_operators.map)((e2) => this.transformEvent(e2)));
  }
  transformEvent(e) {
    switch (e.type) {
      case Q: {
        this.currentReasoningId = k();
        let { title: t, ...n } = e;
        return this.warnAboutTransformation(Q, EventType.REASONING_START), { ...n, type: EventType.REASONING_START, messageId: this.currentReasoningId };
      }
      case we:
        return this.currentMessageId = k(), this.warnAboutTransformation(we, EventType.REASONING_MESSAGE_START), { ...e, type: EventType.REASONING_MESSAGE_START, messageId: this.currentMessageId, role: `assistant` };
      case Te: {
        let { delta: t, ...n } = e;
        return this.warnAboutTransformation(Te, EventType.REASONING_MESSAGE_CONTENT), { ...n, type: EventType.REASONING_MESSAGE_CONTENT, messageId: this.currentMessageId ?? k(), delta: t };
      }
      case Ee: {
        let t = this.currentMessageId ?? k();
        return this.warnAboutTransformation(Ee, EventType.REASONING_MESSAGE_END), { ...e, type: EventType.REASONING_MESSAGE_END, messageId: t };
      }
      case Ce: {
        let t = this.currentReasoningId ?? k();
        return this.warnAboutTransformation(Ce, EventType.REASONING_END), { ...e, type: EventType.REASONING_END, messageId: t };
      }
      default:
        return e;
    }
  }
};
function Oe(e) {
  return e.startsWith(`image/`) ? `image` : e.startsWith(`audio/`) ? `audio` : e.startsWith(`video/`) ? `video` : `document`;
}
function ke(e) {
  return typeof e == `object` && !!e && `type` in e && e.type === `binary` && `mimeType` in e && typeof e.mimeType == `string`;
}
function Ae(e) {
  let t = Oe(e.mimeType);
  return e.data ? { type: t, source: { type: `data`, value: e.data, mimeType: e.mimeType }, ...e.filename ? { metadata: { filename: e.filename } } : {} } : e.url ? { type: t, source: { type: `url`, value: e.url, mimeType: e.mimeType }, ...e.filename ? { metadata: { filename: e.filename } } : {} } : e;
}
function je(e) {
  let t = e.content;
  if (!Array.isArray(t)) return e;
  let n = t.map((e2) => ke(e2) ? Ae(e2) : e2);
  return { ...e, content: n };
}
var Me = class extends Y {
  run(e, t) {
    let n = { ...e, messages: e.messages.map(je) };
    return this.runNext(n, t);
  }
};
var Ne = `0.0.58`;
var Pe = class {
  get maxVersion() {
    return Ne;
  }
  get debug() {
    return this._debug;
  }
  set debug(e) {
    this._debug = P(e), this._debugLogger = L(this._debug);
  }
  get debugLogger() {
    return this._debugLogger;
  }
  set debugLogger(e) {
    typeof e == `boolean` ? this._debugLogger = e ? L(P(true)) : void 0 : this._debugLogger = e;
  }
  constructor({ agentId: t, description: n, threadId: r, initialMessages: i, initialState: a2, debug: o2 } = {}) {
    this.subscribers = [], this.isRunning = false, this.pendingInterrupts = [], this.middlewares = [], this.agentId = t, this.description = n ?? ``, this.threadId = r ?? v4_default(), this.messages = O(i ?? []), this.state = O(a2 ?? {}), this._debug = P(o2), this._debugLogger = L(this._debug), (0, import_compare_versions.compareVersions)(this.maxVersion, `0.0.39`) <= 0 && this.middlewares.unshift(new Z()), (0, import_compare_versions.compareVersions)(this.maxVersion, `0.0.45`) <= 0 && this.middlewares.unshift(new De()), (0, import_compare_versions.compareVersions)(this.maxVersion, `0.0.47`) <= 0 && this.middlewares.unshift(new Me());
  }
  subscribe(e) {
    return this.subscribers.push(e), { unsubscribe: () => {
      this.subscribers = this.subscribers.filter((t) => t !== e);
    } };
  }
  use(...e) {
    let t = e.map((e2) => typeof e2 == `function` ? new X(e2) : e2);
    return this.middlewares.push(...t), this;
  }
  async runAgent(t, n) {
    try {
      this.isRunning = true, this.agentId = this.agentId ?? v4_default();
      let r = this.prepareRunAgentInput(t);
      this.debugLogger?.lifecycle(`LIFECYCLE`, `Run started:`, { agentId: this.agentId, threadId: this.threadId });
      let i, a2 = new Set(this.messages.map((e) => e.id)), o2 = [{ onRunFinishedEvent: (e) => {
        e.outcome === `success` && (i = e.result);
      } }, ...this.subscribers, n ?? {}];
      await this.onInitialize(r, o2), this.activeRunDetach$ = new import_rxjs.Subject();
      let s2;
      this.activeRunCompletionPromise = new Promise((e) => {
        s2 = e;
      }), await (0, import_rxjs.lastValueFrom)((0, import_rxjs.pipe)(() => this.middlewares.length === 0 ? this.run(r) : this.middlewares.reduceRight((e, t2) => ({ run: (n2) => t2.run(n2, e), get messages() {
        return e.messages;
      }, get state() {
        return e.state;
      } }), this).run(r), q(this.debugLogger), z(this.debugLogger), (e) => e.pipe((0, import_operators.takeUntil)(this.activeRunDetach$)), (e) => this.apply(r, e, o2), (e) => this.processApplyEvents(r, e, o2), (0, import_operators.catchError)((e) => (this.debugLogger?.lifecycle(`LIFECYCLE`, `Run errored:`, { agentId: this.agentId, error: e instanceof Error ? e.message : String(e) }), this.isRunning = false, this.onError(r, e, o2))), (0, import_operators.finalize)(() => {
        this.debugLogger?.lifecycle(`LIFECYCLE`, `Run finished:`, { agentId: this.agentId, threadId: this.threadId }), this.isRunning = false, this.onFinalize(r, o2), s2?.(), s2 = void 0, this.activeRunCompletionPromise = void 0, this.activeRunDetach$ = void 0;
      }))((0, import_rxjs.of)(null)));
      let c2 = O(this.messages).filter((e) => !a2.has(e.id));
      return { result: i, newMessages: c2 };
    } finally {
      this.isRunning = false;
    }
  }
  connect(e) {
    throw new AGUIConnectNotImplementedError();
  }
  async connectAgent(n, r) {
    try {
      this.isRunning = true, this.agentId = this.agentId ?? v4_default();
      let i = this.prepareRunAgentInput(n), a2, s2 = new Set(this.messages.map((e) => e.id)), c2 = [{ onRunFinishedEvent: (e) => {
        e.outcome === `success` && (a2 = e.result);
      } }, ...this.subscribers, r ?? {}];
      await this.onInitialize(i, c2), this.activeRunDetach$ = new import_rxjs.Subject();
      let d2;
      this.activeRunCompletionPromise = new Promise((e) => {
        d2 = e;
      }), await (0, import_rxjs.lastValueFrom)((0, import_rxjs.pipe)(() => (0, import_rxjs.defer)(() => this.connect(i)), q(this.debugLogger), z(this.debugLogger), (e) => e.pipe((0, import_operators.takeUntil)(this.activeRunDetach$)), (e) => this.apply(i, e, c2), (e) => this.processApplyEvents(i, e, c2), (0, import_operators.catchError)((e) => (this.isRunning = false, e instanceof AGUIConnectNotImplementedError ? import_rxjs.EMPTY : this.onError(i, e, c2))), (0, import_operators.finalize)(() => {
        this.isRunning = false, this.onFinalize(i, c2), d2?.(), d2 = void 0, this.activeRunCompletionPromise = void 0, this.activeRunDetach$ = void 0;
      }))((0, import_rxjs.of)(null)), { defaultValue: void 0 });
      let f2 = O(this.messages).filter((e) => !s2.has(e.id));
      return { result: a2, newMessages: f2 };
    } finally {
      this.isRunning = false;
    }
  }
  abortRun() {
  }
  async detachActiveRun() {
    if (!this.activeRunDetach$) return;
    let e = this.activeRunCompletionPromise ?? Promise.resolve();
    this.activeRunDetach$.next(), this.activeRunDetach$?.complete(), await e;
  }
  apply(e, t, n) {
    return R(e, t, this, n, this.debugLogger);
  }
  processApplyEvents(e, t, n) {
    return t.pipe((0, import_operators.tap)((t2) => {
      t2.messages && (this.messages = t2.messages, n.forEach((t3) => {
        t3.onMessagesChanged?.({ messages: this.messages, state: this.state, agent: this, input: e });
      })), t2.state && (this.state = t2.state, n.forEach((t3) => {
        t3.onStateChanged?.({ state: this.state, messages: this.messages, agent: this, input: e });
      }));
    }));
  }
  prepareRunAgentInput(t) {
    let n = O(this.messages).filter((e) => e.role !== `activity`);
    return { threadId: this.threadId, runId: t?.runId || v4_default(), tools: O(t?.tools ?? []), context: O(t?.context ?? []), forwardedProps: O(t?.forwardedProps ?? {}), state: O(this.state), messages: n, ...t?.resume === void 0 ? {} : { resume: O(t.resume) } };
  }
  async onInitialize(e, t) {
    if (this.pendingInterrupts.length > 0) {
      let t2 = new Set((e.resume ?? []).map((e2) => e2.interruptId)), r2 = this.pendingInterrupts.map((e2) => e2.id).filter((e2) => !t2.has(e2));
      if (r2.length > 0) throw new AGUIError(`Thread has ${r2.length} pending interrupt(s) not addressed by resume: ${r2.join(`, `)}`);
      for (let e2 of this.pendingInterrupts) if (J(e2)) throw new AGUIError(`Interrupt ${e2.id} expired at ${e2.expiresAt}`);
    }
    let r = await N(t, this.messages, this.state, (t2, n, r2) => t2.onRunInitialized?.({ messages: n, state: r2, agent: this, input: e }));
    (r.messages !== void 0 || r.state !== void 0) && (r.messages && (this.messages = r.messages, e.messages = r.messages, t.forEach((t2) => {
      t2.onMessagesChanged?.({ messages: this.messages, state: this.state, agent: this, input: e });
    })), r.state && (this.state = r.state, e.state = r.state, t.forEach((t2) => {
      t2.onStateChanged?.({ state: this.state, messages: this.messages, agent: this, input: e });
    })));
  }
  onError(e, t, n) {
    return (0, import_rxjs.from)(N(n, this.messages, this.state, (n2, r, i) => n2.onRunFailed?.({ error: t, messages: r, state: i, agent: this, input: e }))).pipe((0, import_operators.map)((r) => {
      let i = r;
      if ((i.messages !== void 0 || i.state !== void 0) && (i.messages !== void 0 && (this.messages = i.messages, n.forEach((t2) => {
        t2.onMessagesChanged?.({ messages: this.messages, state: this.state, agent: this, input: e });
      })), i.state !== void 0 && (this.state = i.state, n.forEach((t2) => {
        t2.onStateChanged?.({ state: this.state, messages: this.messages, agent: this, input: e });
      }))), i.stopPropagation !== true) {
        let e2 = String(t);
        if (!(t.name === `AbortError` || t.message === `Fetch is aborted` || t.message === `signal is aborted without reason` || t.message === `component unmounted` || e2 === `component unmounted`)) throw console.error(`Agent execution failed:`, t), t;
      }
      return {};
    }));
  }
  async onFinalize(e, t) {
    let n = await N(t, this.messages, this.state, (t2, n2, r) => t2.onRunFinalized?.({ messages: n2, state: r, agent: this, input: e }));
    (n.messages !== void 0 || n.state !== void 0) && (n.messages !== void 0 && (this.messages = n.messages, t.forEach((t2) => {
      t2.onMessagesChanged?.({ messages: this.messages, state: this.state, agent: this, input: e });
    })), n.state !== void 0 && (this.state = n.state, t.forEach((t2) => {
      t2.onStateChanged?.({ state: this.state, messages: this.messages, agent: this, input: e });
    })));
  }
  clone() {
    let e = Object.create(Object.getPrototypeOf(this));
    return e.agentId = this.agentId, e.description = this.description, e.threadId = this.threadId, e.messages = O(this.messages), e.state = O(this.state), e._debug = this._debug, e._debugLogger = this._debugLogger, e.isRunning = this.isRunning, e.subscribers = [...this.subscribers], e.middlewares = [...this.middlewares], e.pendingInterrupts = O(this.pendingInterrupts), e;
  }
  addMessage(e) {
    this.messages.push(e), (async () => {
      for (let t of this.subscribers) await t.onNewMessage?.({ message: e, messages: this.messages, state: this.state, agent: this });
      if (e.role === `assistant` && e.toolCalls) for (let t of e.toolCalls) for (let e2 of this.subscribers) await e2.onNewToolCall?.({ toolCall: t, messages: this.messages, state: this.state, agent: this });
      for (let e2 of this.subscribers) await e2.onMessagesChanged?.({ messages: this.messages, state: this.state, agent: this });
    })();
  }
  addMessages(e) {
    this.messages.push(...e), (async () => {
      for (let t of e) {
        for (let e2 of this.subscribers) await e2.onNewMessage?.({ message: t, messages: this.messages, state: this.state, agent: this });
        if (t.role === `assistant` && t.toolCalls) for (let e2 of t.toolCalls) for (let t2 of this.subscribers) await t2.onNewToolCall?.({ toolCall: e2, messages: this.messages, state: this.state, agent: this });
      }
      for (let e2 of this.subscribers) await e2.onMessagesChanged?.({ messages: this.messages, state: this.state, agent: this });
    })();
  }
  setMessages(e) {
    this.messages = O(e), (async () => {
      for (let e2 of this.subscribers) await e2.onMessagesChanged?.({ messages: this.messages, state: this.state, agent: this });
    })();
  }
  setState(e) {
    this.state = O(e), (async () => {
      for (let e2 of this.subscribers) await e2.onStateChanged?.({ messages: this.messages, state: this.state, agent: this });
    })();
  }
  legacy_to_be_removed_runAgentBridged(t) {
    this.agentId = this.agentId ?? v4_default();
    let n = this.prepareRunAgentInput(t);
    return (this.middlewares.length === 0 ? this.run(n) : this.middlewares.reduceRight((e, t2) => ({ run: (n2) => t2.run(n2, e), get messages() {
      return e.messages;
    }, get state() {
      return e.state;
    } }), this).run(n)).pipe(q(this.debugLogger), z(this.debugLogger), K(this.threadId, n.runId, this.agentId), (e) => e.pipe((0, import_operators.map)((e2) => (this.debugLogger?.event(`LEGACY`, `Event:`, e2, { type: e2.type }), e2))));
  }
};
var Fe = class extends Pe {
  requestInit(e) {
    return { method: `POST`, headers: { ...this.headers, "Content-Type": `application/json`, Accept: `text/event-stream` }, body: JSON.stringify(e), signal: this.abortController.signal };
  }
  runAgent(e, t) {
    return this.abortController = e?.abortController ?? new AbortController(), super.runAgent(e, t);
  }
  abortRun() {
    this.abortController.abort(), super.abortRun();
  }
  constructor(e) {
    super(e), this.abortController = new AbortController(), this.url = e.url, this.headers = O(e.headers ?? {}), this.fetch = e.fetch ?? ((e2, t) => fetch(e2, t));
  }
  run(e) {
    return W(V(() => this.fetch(this.url, this.requestInit(e))), this.debugLogger);
  }
  clone() {
    let e = super.clone();
    e.url = this.url, e.headers = O(this.headers ?? {}), e.fetch = this.fetch;
    let t = new AbortController(), n = this.abortController.signal;
    return n.aborted && t.abort(n.reason), e.abortController = t, e;
  }
};

// server/contracts.ts
var eventCounter = 0;
var newEventId = () => `ev-${Date.now().toString(36)}-${(eventCounter++).toString(36)}`;
var newId = () => crypto.randomUUID();

// server/drivers/agui/endpoint.ts
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
var NEVER_ALLOWED = /* @__PURE__ */ new Set(["metadata.google.internal", "metadata.google", "169.254.169.254", "169.254.170.2", "100.100.100.200"]);
function privateAddress(address) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 169 && parts[1] === 254 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 || parts[0] === 192 && parts[1] === 168 || parts[0] === 0;
}
var systemResolver = async (hostname) => {
  if (isIP(hostname)) return [{ address: hostname, family: isIP(hostname) }];
  return lookup(hostname, { all: true, verbatim: true });
};
async function checkAguiEndpoint(raw, options = {}) {
  if (typeof raw !== "string" || !raw.trim()) return { allowed: false, reason: "An AG-UI agent needs an endpoint URL." };
  let endpoint;
  try {
    endpoint = new URL(raw.trim());
  } catch {
    return { allowed: false, reason: "The AG-UI endpoint is not a valid URL." };
  }
  if (!["http:", "https:"].includes(endpoint.protocol)) return { allowed: false, reason: "Only HTTP and HTTPS AG-UI endpoints are supported." };
  if (endpoint.username || endpoint.password) return { allowed: false, reason: "Put credentials in the encrypted auth field, not in the endpoint URL." };
  if (endpoint.hash) return { allowed: false, reason: "An AG-UI endpoint URL cannot contain a fragment." };
  const hostname = endpoint.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (NEVER_ALLOWED.has(hostname)) return { allowed: false, reason: "Cloud and local metadata endpoints can never be registered as agents." };
  let addresses;
  try {
    addresses = await (options.resolver ?? systemResolver)(hostname);
  } catch {
    return { allowed: false, reason: "The AG-UI endpoint hostname could not be resolved." };
  }
  if (!addresses.length) return { allowed: false, reason: "The AG-UI endpoint hostname has no network address." };
  for (const entry of addresses) {
    if (NEVER_ALLOWED.has(entry.address.toLowerCase())) return { allowed: false, reason: "Cloud and local metadata endpoints can never be registered as agents." };
    if (privateAddress(entry.address) && !options.allowPrivateHosts) {
      return { allowed: false, reason: "Private-network AG-UI endpoints are disabled for this deployment." };
    }
  }
  const allPrivate = addresses.every((entry) => privateAddress(entry.address));
  if (endpoint.protocol === "http:" && !allPrivate) return { allowed: false, reason: "Public AG-UI endpoints must use HTTPS." };
  return { allowed: true, url: endpoint.toString() };
}

// server/drivers/agui.ts
var DRIVER_KIND = "agui";
var MODELS = { default: "remote", options: [{ id: "remote", label: "Remote agent" }] };
function decodeConfig(raw) {
  const value = raw ?? {};
  const endpoint = typeof value.endpoint === "string" ? value.endpoint.trim() : "";
  if (!endpoint) throw new Error("AG-UI endpoint is required");
  const authHeader = typeof value.authHeader === "string" && value.authHeader.trim() ? value.authHeader.trim() : "Authorization";
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(authHeader)) throw new Error("AG-UI auth header name is invalid");
  return {
    endpoint,
    authHeader,
    authEnv: typeof value.authEnv === "string" ? value.authEnv : "",
    allowPrivateHosts: value.allowPrivateHosts !== false
  };
}
function aguiMessages(turn) {
  return [
    ...turn.system ? [{ id: newId(), role: "system", content: turn.system }] : [],
    ...(turn.transcript ?? []).map((message) => ({
      id: newId(),
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.text
    })),
    { id: newId(), role: "user", content: turn.text }
  ];
}
var AguiDriver = {
  driverKind: DRIVER_KIND,
  metadata: { displayName: "AG-UI Agent", supportsMultipleInstances: true },
  models: MODELS,
  decodeConfig,
  defaultConfig: () => decodeConfig({ endpoint: "http://127.0.0.1:8000/ag-ui" }),
  async create(input) {
    const { instanceId, config } = input;
    const listeners = /* @__PURE__ */ new Set();
    const active = /* @__PURE__ */ new Map();
    const authValue = config.authEnv ? input.environment[config.authEnv] ?? process.env[config.authEnv] : void 0;
    const headers = authValue ? { [config.authHeader]: authValue } : void 0;
    const emit = (event) => {
      for (const listener of [...listeners]) listener(event);
    };
    const base = (threadId, turnId) => ({
      eventId: newEventId(),
      provider: DRIVER_KIND,
      providerInstanceId: instanceId,
      threadId,
      turnId,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    const snapshot = async () => {
      const verdict = await checkAguiEndpoint(config.endpoint, { allowPrivateHosts: config.allowPrivateHosts });
      if (!verdict.allowed) return { state: "unavailable", reason: verdict.reason };
      return { state: "available", authenticated: true, version: "AG-UI HTTP/SSE" };
    };
    const sendTurn = async (turn) => {
      if (active.has(turn.threadId)) throw new Error("an AG-UI run is already active on this thread");
      const verdict = await checkAguiEndpoint(config.endpoint, { allowPrivateHosts: config.allowPrivateHosts });
      if (!verdict.allowed) throw new Error(verdict.reason);
      const turnId = newId();
      const abort = new AbortController();
      active.set(turn.threadId, { abort, turnId });
      const agent = new Fe({
        url: verdict.url,
        agentId: instanceId,
        threadId: turn.threadId,
        initialMessages: aguiMessages(turn),
        ...headers ? { headers } : {}
      });
      emit({ ...base(turn.threadId, turnId), type: "turn.started" });
      emit({ ...base(turn.threadId, turnId), type: "session.started", sessionId: turn.threadId, model: turn.model ?? MODELS.default });
      void (async () => {
        let finished = false;
        let failed = false;
        try {
          await agent.runAgent(
            { abortController: abort, forwardedProps: { mauscrewBotId: turn.threadId, mauscrewProviderInstanceId: instanceId } },
            {
              onTextMessageContentEvent: ({ event }) => {
                if (event.delta) emit({ ...base(turn.threadId, turnId), type: "content.delta", streamKind: "assistant_text", delta: event.delta });
              },
              onTextMessageEndEvent: ({ textMessageBuffer }) => {
                if (textMessageBuffer.trim()) {
                  emit({ ...base(turn.threadId, turnId), type: "item.completed", itemType: "assistant_text", text: textMessageBuffer });
                }
              },
              onToolCallStartEvent: ({ event }) => {
                emit({
                  ...base(turn.threadId, turnId),
                  type: "item.started",
                  itemType: "tool",
                  itemId: event.toolCallId,
                  title: event.toolCallName,
                  raw: { source: "ag-ui", payload: { type: event.type, toolCallId: event.toolCallId, toolCallName: event.toolCallName } }
                });
              },
              onToolCallEndEvent: ({ event, toolCallName }) => {
                emit({ ...base(turn.threadId, turnId), type: "item.completed", itemType: "tool", itemId: event.toolCallId, ok: true, raw: { source: "ag-ui", payload: { type: event.type, toolCallName } } });
              },
              onRunErrorEvent: ({ event }) => {
                failed = true;
                emit({ ...base(turn.threadId, turnId), type: "runtime.error", message: event.message || "The AG-UI run failed." });
              },
              onRunFinishedEvent: () => {
                finished = true;
              },
              onRunFailed: ({ error }) => {
                failed = true;
                emit({ ...base(turn.threadId, turnId), type: "runtime.error", message: error.message });
              }
            }
          );
          if (!finished && !failed && !abort.signal.aborted) {
            failed = true;
            emit({ ...base(turn.threadId, turnId), type: "runtime.error", message: "The AG-UI stream ended without RUN_FINISHED or RUN_ERROR." });
          }
        } catch (error) {
          failed = true;
          if (!abort.signal.aborted) emit({ ...base(turn.threadId, turnId), type: "runtime.error", message: error instanceof Error ? error.message : String(error) });
        } finally {
          active.delete(turn.threadId);
          emit({ ...base(turn.threadId, turnId), type: "turn.completed", ok: finished && !failed && !abort.signal.aborted, stopReason: abort.signal.aborted ? "interrupted" : failed ? "error" : null, cost: null });
        }
      })();
      return { turnId };
    };
    return {
      instanceId,
      driverKind: DRIVER_KIND,
      displayName: input.displayName,
      enabled: input.enabled,
      models: MODELS,
      snapshot,
      adapter: {
        provider: DRIVER_KIND,
        capabilities: { sessionModelSwitch: "unsupported" },
        sendTurn,
        interruptTurn: async (threadId) => active.get(threadId)?.abort.abort(),
        respondToRequest: async () => {
          throw new Error("AG-UI remote interrupts are not mapped to MausCrew approvals yet");
        },
        hasSession: (threadId) => active.has(threadId),
        stopAll: async () => {
          for (const run of active.values()) run.abort.abort();
        },
        onEvent: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        }
      },
      dispose: async () => {
        for (const run of active.values()) run.abort.abort();
        active.clear();
        listeners.clear();
      }
    };
  }
};
export {
  AguiDriver
};
/*! Bundled license information:

fast-json-patch/commonjs/helpers.js:
  (*!
   * https://github.com/Starcounter-Jack/JSON-Patch
   * (c) 2017-2022 Joachim Wester
   * MIT licensed
   *)

fast-json-patch/commonjs/duplex.js:
  (*!
   * https://github.com/Starcounter-Jack/JSON-Patch
   * (c) 2017-2021 Joachim Wester
   * MIT license
   *)
*/
