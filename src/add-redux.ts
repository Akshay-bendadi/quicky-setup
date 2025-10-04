import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Types for the function parameters
type Framework = 'react' | 'next';
type Language = 'js' | 'ts';

interface SetupOptions {
    framework: Framework;
    language: Language;
    projectPath: string;
}

// Main function to set up Redux
export async function addRedux({ framework, language, projectPath }: SetupOptions): Promise<void> {
    const isTypeScript = language === 'ts';
    const ext = isTypeScript ? 'ts' : 'js';

    console.log(`Setting up Redux for ${framework} with ${language}...`);

    // --- Directory Structure ---
    const storeDir = framework === 'next'
        ? path.join(projectPath, 'store')
        : path.join(projectPath, 'src', 'store');
    const featuresDir = path.join(storeDir, 'features', 'counter');
    const typesDir = path.join(storeDir, 'types');
    const hooksDir = framework === 'next'
        ? path.join(projectPath, 'hooks')
        : path.join(projectPath, 'src', 'hooks');

    // --- Helper: Make Directory ---
    function ensureDir(dir: string) {
        if (!fs.existsSync(dir)) {
            console.log(`Creating directory: ${dir}`);
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    // --- File Templates ---
    const storeImports = isTypeScript
        ? `import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';`
        : `import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';`;

    const storeTypes = isTypeScript
        ? `
// Infer the RootState and AppDispatch types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Use throughout your app instead of plain 'useDispatch' and 'useSelector'
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
`
        : '';

    const storeContent = `${storeImports}

// Import your reducers here
import counterReducer from './features/counter/counterSlice';

// Create the store first
export const store = configureStore({
  reducer: {
    counter: counterReducer,
    // Add other reducers here
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

// Setup listeners for refetchOnFocus/refetchOnReconnect behaviors
setupListeners(store.dispatch);

${storeTypes}

export default store;
`;

    // --- counterSlice.ts/js ---
    const sliceImports = isTypeScript
        ? `import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { fetchCounter } from './counterThunks';

// Define the shape of the state
export interface CounterState {
  value: number;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  lastUpdated?: number;
}

// Initial state with type
const initialState: CounterState = {
  value: 0,
  status: 'idle',
  error: null,
  lastUpdated: Date.now(),
};`
        : `import { createSlice } from '@reduxjs/toolkit';
import { fetchCounter } from './counterThunks';

// Initial state
const initialState = {
  value: 0,
  status: 'idle',
  error: null,
  lastUpdated: Date.now(),
};`;

    const sliceContent = `${sliceImports}

export const counterSlice = createSlice({
  name: 'counter',
  initialState,
  reducers: {
    increment: (state) => { 
      state.value += 1;
    },
    decrement: (state) => { 
      state.value -= 1;
    },
    incrementByAmount: (state, action${isTypeScript ? ': PayloadAction<number>' : ''}) => {
      state.value += action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCounter.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchCounter.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.value = action.payload;
        state.lastUpdated = Date.now();
      })
      .addCase(fetchCounter.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload${isTypeScript ? ' as string' : ''} || 'An error occurred';
        state.lastUpdated = Date.now();
      });
  },
});

// Export actions
export const { increment, decrement, incrementByAmount } = counterSlice.actions;

// Selectors
export const selectCount = (state${isTypeScript ? ': { counter: { value: number } }' : ''}) => state.counter.value;
${isTypeScript ? `export const selectStatus = (state: { counter: { status: string } }) => state.counter.status;` : ''}

// Export the reducer as a default export
export default counterSlice.reducer;
`;

    const thunkContent = isTypeScript
        ? `import { createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Fetches the current counter value from the server
 * @returns A promise that resolves to the counter value
 */
export const fetchCounter = createAsyncThunk<
  number,           // Return type of the payload creator
  void,             // First argument to the payload creator
  { rejectValue: string }  // Types for ThunkAPI
>(
  'counter/fetchCounter',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/counter');
      if (!response.ok) {
        throw new Error('Failed to fetch counter');
      }
      const data = await response.json();
      return data.value; // Assuming the API returns { value: number }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);`
        : `import { createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Fetches the current counter value from the server
 * @returns A promise that resolves to the counter value
 */
export const fetchCounter = createAsyncThunk(
  'counter/fetchCounter',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/counter');
      if (!response.ok) {
        throw new Error('Failed to fetch counter');
      }
      const data = await response.json();
      return data.value; // Assuming the API returns { value: number }
    } catch (error) {
      return rejectWithValue(error.message || 'Unknown error');
    }
  }
);`;

    // --- Redux hooks content for hooks/redux.ts ---
    const reduxHooksContent = `import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "${framework === 'next' ? 'store/store' : 'src/store/store'}";

// Use throughout your app instead of plain \`useDispatch\` and \`useSelector\`
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
`;

    // --- Types file content (TypeScript only) ---
    const typesContent = `/**
 * Counter state interface
 */
export interface ICounterState {
  /** Current counter value */
  value: number;
  /** Current status of async operations */
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  /** Error message if any */
  error: string | null;
  /** Timestamp of last update */
  lastUpdated?: number;
}

/** Payload for counter actions */
export interface ICounterPayload { 
  /** Amount to increment/decrement by */
  amount: number; 
}

/** Standard error response */
export interface IErrorResponse { 
  /** Error message */
  message: string; 
  /** Optional error code */
  code?: number; 
}

/** Counter API response */
export interface ICounterResponse { 
  /** Current counter value */
  value: number; 
  /** ISO timestamp of the response */
  timestamp: string; 
}`;

    // Create all necessary directories
    ensureDir(storeDir);
    ensureDir(featuresDir);
    ensureDir(typesDir);
    ensureDir(hooksDir);

    // Write all the files
    fs.writeFileSync(path.join(storeDir, `store.${ext}`), storeContent);
    fs.writeFileSync(path.join(featuresDir, `counterSlice.${ext}`), sliceContent);
    fs.writeFileSync(path.join(featuresDir, `counterThunks.${ext}`), thunkContent);

    if (isTypeScript) {
        fs.writeFileSync(path.join(typesDir, "counter.types.ts"), typesContent);
        fs.writeFileSync(path.join(hooksDir, "redux.ts"), reduxHooksContent);
    }

    console.log('✅ Redux setup complete!');
}

// --- CLI support: allow direct execution via npx or node ---
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const getArg = (flag: string, fallback = '') => {
        const idx = args.indexOf(flag);
        return idx !== -1 && idx < args.length - 1 ? args[idx + 1] : fallback;
    };

    const options = {
        framework: (getArg('--framework') || 'react').toLowerCase() as Framework,
        language: (getArg('--language') || 'js').toLowerCase() as Language,
        projectPath: process.cwd()
    };

    addRedux(options).catch(console.error);
}

export { addRedux as default };