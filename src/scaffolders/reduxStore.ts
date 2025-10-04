import fs from "fs";
import path from "path";

type Framework = "next" | "react";

export function scaffoldReduxStore(projectPath: string, language: "js" | "ts", framework: Framework): void {
  const ext = language === "ts" ? "ts" : "js";
  const isTypeScript = language === "ts";
  
  // Determine store directory based on framework
  const storeDir = framework === "next" 
    ? path.join(projectPath, "store") 
    : path.join(projectPath, "src", "store");

  // Ensure the store directory exists
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }

  // Store content with TypeScript types conditionally
  const storeImports = isTypeScript 
    ? `import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
`
    : `import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
`;

  const storeTypes = isTypeScript 
    ? `
// TypeScript types
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

export const store = configureStore({
  reducer: {
    counter: counterReducer,
    // Add other reducers here
  },
  // Add any middleware here
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),

// Enable refetchOnFocus/refetchOnReconnect behaviors
setupListeners(store.dispatch);

${storeTypes}
export default store;`;

  fs.writeFileSync(path.join(storeDir, `store.${ext}`), storeContent);

  // Slice content with TypeScript types conditionally
  const sliceImports = isTypeScript
    ? `import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { fetchCounter } from './counterThunks';

// Define the shape of the counter state
export interface CounterState {
  value: number;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  lastUpdated?: number;
}

// Initial state with type safety
const initialState: CounterState = {
  value: 0,                    // Current counter value
  status: 'idle',             // Async operation status
  error: null,                // Error message if any
  lastUpdated: Date.now()     // Timestamp of last update
};`
    : `import { createSlice } from '@reduxjs/toolkit';
import { fetchCounter } from './counterThunks';

// Initial state for JavaScript
const initialState = {
  value: 0,                    // Current counter value
  status: 'idle',             // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,                // Error message if any
  lastUpdated: Date.now()     // Timestamp of last update
};`;

  const sliceContent = `${sliceImports}

export const counterSlice = createSlice({
  name: 'counter',
  initialState,
  // Reducer functions for synchronous actions
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
  // Handle async actions with extraReducers if needed
  extraReducers: (builder) => {
    // Handle fetchCounter thunk
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
        state.error = action.payload as string || 'An error occurred';
        state.lastUpdated = Date.now();
      });
  },
});

export const { increment, decrement, incrementByAmount } = counterSlice.actions;

// Selectors
export const selectCount = (state${isTypeScript ? ': { counter: { value: number } }' : ''}) => state.counter.value;
${isTypeScript ? `
// Additional TypeScript selectors
export const selectStatus = (state: { counter: { status?: string } }) => state.counter.status;
` : ''}

export default counterSlice.reducer;`;

  // Create features directory structure inside store
  const featuresDir = path.join(storeDir, 'features', 'counter');
  const typesDir = path.join(storeDir, 'types');
  
  // Create necessary directories
  [featuresDir, typesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Create counter slice file
  fs.writeFileSync(path.join(featuresDir, `counterSlice.${ext}`), sliceContent);

  // Create thunks file
  const thunkContent = isTypeScript ? `import { createAsyncThunk } from '@reduxjs/toolkit';
import type { AppDispatch, RootState } from '../../store';

// Define the async thunk
export const fetchCounter = createAsyncThunk<
  number, // Return type of the payload creator
  void,   // First argument to the payload creator
  { 
    dispatch: AppDispatch;
    state: RootState;
    rejectValue: string;
  }
>(
  'counter/fetchCounter',
  async (_, { rejectWithValue }) => {
    try {
      // Replace with your actual API call
      const response = await fetch('/api/counter');
      if (!response.ok) {
        throw new Error('Failed to fetch counter');
      }
      return await response.json();
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

// Add more thunks as needed
` : `import { createAsyncThunk } from '@reduxjs/toolkit';

// Define the async thunk
export const fetchCounter = createAsyncThunk(
  'counter/fetchCounter',
  async (_, { rejectWithValue }) => {
    try {
      // Replace with your actual API call
      const response = await fetch('/api/counter');
      if (!response.ok) {
        throw new Error('Failed to fetch counter');
      }
      return await response.json();
    } catch (error) {
      return rejectWithValue(error.message || 'Unknown error');
    }
  }
);

// Add more thunks as needed
`;

  fs.writeFileSync(path.join(featuresDir, `counterThunks.${ext}`), thunkContent);

  // Create types file if TypeScript
  if (isTypeScript) {
    const typesContent = `// Counter state type
export interface ICounterState {
  value: number;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

// Payload types for actions
export interface ICounterPayload {
  amount: number;
}

// Error response type
export interface IErrorResponse {
  message: string;
  code?: number;
}

// API response types
export interface ICounterResponse {
  value: number;
  timestamp: string;
}
`;
    fs.writeFileSync(path.join(typesDir, 'counter.types.ts'), typesContent);
  }

  // Create hooks file for TypeScript
  if (isTypeScript) {
    const hooksContent = `import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';

// Use throughout your app instead of plain 'useDispatch' and 'useSelector'
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Example custom hook for counter
export const useCounter = () => {
  const count = useAppSelector((state) => state.counter.value);
  const status = useAppSelector((state) => state.counter.status);
  const error = useAppSelector((state) => state.counter.error);
  const dispatch = useAppDispatch();

  return {
    count,
    status,
    error,
    // Add more counter-related functions as needed
  };
};`;

    fs.writeFileSync(path.join(storeDir, 'hooks.ts'), hooksContent);
  }

  console.log("✅ Redux store created!");
}
