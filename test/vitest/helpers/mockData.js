/**
 * Load mock data files that are defined as globals in Karma.
 * We use dynamic evaluation to avoid modifying the original files.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

var __dirname = dirname(fileURLToPath(import.meta.url));
var mockDir = resolve(__dirname, '../../mock');

// mockExplain.js sets: mockExplain = {...}
var mockExplainCode = readFileSync(resolve(mockDir, 'mockExplain.js'), 'utf-8');
var mockExplainFn = new Function('var mockExplain; var addExplain;\n' + mockExplainCode + '\nreturn { mockExplain: mockExplain, addExplain: addExplain };');
var _mockExplainResult = mockExplainFn();
export var mockExplain = _mockExplainResult.mockExplain;
export var addExplain = _mockExplainResult.addExplain;

// bigHonkinExplain.js sets: bigHonkinExplain = {...}
var bigHonkinCode = readFileSync(resolve(mockDir, 'bigHonkinExplain.js'), 'utf-8');
var bigHonkinFn = new Function('var bigHonkinExplain;\n' + bigHonkinCode + '\nreturn bigHonkinExplain;');
export var bigHonkinExplain = bigHonkinFn();

// mockExplainOther.js sets: mockExplainOther = {...}
var mockExplainOtherCode = readFileSync(resolve(mockDir, 'mockExplainOther.js'), 'utf-8');
var mockExplainOtherFn = new Function('var mockExplainOther;\n' + mockExplainOtherCode + '\nreturn mockExplainOther;');
export var mockExplainOther = mockExplainOtherFn();
