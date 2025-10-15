import { createContext, useContext, useRef, useState } from "react";
import type { MutableRefObject } from "react";

const PropertiesContext = createContext<{ properties: MutableRefObject<any>, components: MutableRefObject<any>, viewport: MutableRefObject<any>, update: MutableRefObject<() => void>}>(null);

// Hook to use AuthContext
export const useProperties = () => useContext(PropertiesContext);

export const PropertiesProvider = ({ children }) => {
    const properties = useRef<any>(null);
    const components = useRef<any>(null);
    const viewport = useRef<any>(null);
    const update = useRef(() => {});

    return (
        <PropertiesContext.Provider value={{ properties, components, viewport, update }}>
            {children}
        </PropertiesContext.Provider>
    );
};
