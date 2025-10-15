import {createContext, useContext, useState, useEffect} from "react";
import {makeBIMPortalRequest} from "./api";
import type {paths} from "./types";

const APIContext = createContext(null);

// Hook to use APIContext
export const useAPI = () => useContext <{
    authenticated: boolean,
    login: (mail: string, password: string) => void,
    logout: () => void,
    makeAuthenticatedAPIRequest:
        <T extends keyof paths, M extends "get" | "post">(path: T, method?: M, guid?: (string | undefined), apiHost?: string, body?: (string | undefined)) => Promise<unknown>
}>(APIContext);

export const
    AuthProvider = ({children}) => {

        let bearer: string | null = null;
        let refreshToken: string | null = null;
        let interval = 0;

        let [authenticated, setAuthenticated] = useState(false);

        // @ts-ignore
        function makeAuthenticatedAPIRequest<T extends keyof paths, M extends "get" | "post">(path: T, method: M = "get", guid: string | undefined = undefined, apiHost: string = API_HOST, body: string | undefined = undefined): Promise<unknown> {
            return makeBIMPortalRequest(path, method, guid, method, body, bearer);
        }

        const login = (mail: string, password: string) => {
            const jsonString = JSON.stringify({
                mail, password
            })
            makeBIMPortalRequest("/infrastruktur/api/v1/public/auth/login", "post", undefined, undefined, jsonString).then((result: {
                "token": string,
                "refreshToken": string,
                "validTill": string
            } | null) => {
                if (!result) return;
                bearer = result.token;
                refreshToken = result.refreshToken;
                setAuthenticated(true);
                if (interval) window.clearInterval(interval);
                interval = window.setInterval(() => refresh(), 3600 * 5)
            })

        };

        const refresh = () => {
            const jsonString = JSON.stringify({refreshToken})
            makeBIMPortalRequest("/infrastruktur/api/v1/public/auth/refresh", "post", undefined, undefined, jsonString).then((result: {
                "token": string,
                "refreshToken": string,
                "validTill": string
            } | null) => {
                if (!result) return;
                refreshToken = result.refreshToken;
                bearer = result.token;
            })
        }

        const logout = () => {
            if (!bearer) return;
            setAuthenticated(false);
            makeAuthenticatedAPIRequest("/infrastruktur/api/v1/public/auth/logout", "post")
            if (!interval) return;
            window.clearInterval(interval);
        };

        const value = {login, logout, makeAuthenticatedAPIRequest, authenticated}

        return (
            <APIContext.Provider {...{value}}>
                {children}
            </APIContext.Provider>
        );
    };
