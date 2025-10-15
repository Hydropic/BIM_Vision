import React, {MutableRefObject, useEffect, useState} from "react";
import {makeBIMPortalRequest} from "../BIMPortal/api";
import {useAPI} from "../BIMPortal/context";

const BIMPortalSelectComponent: React.FC<{
    selectedBIMPortalAIAguidRef: MutableRefObject<string | null>
}> = ({selectedBIMPortalAIAguidRef}) => {

    const [choices, setChoices] = useState<Array<{ guid: string, name: string }>>([]);
    const {authenticated, login} = useAPI();
    const [override, setOverride] = useState<boolean>(false);
    const [project, setProject] = useState(null);

    useEffect(() => {
        if (!authenticated) return;
        makeBIMPortalRequest("/aia/api/v1/public/aiaProject", "post").then((result: Array<{
            guid: string,
            name: string
        }>) => {
            if (!Array.isArray(result)) {
                console.error(result, "is not an array");
                return;
            }
            setChoices(result);
        })
    }, [authenticated]);

    useEffect(() => {
        if (!override) return;
        makeBIMPortalRequest("/aia/api/v1/public/aiaProject/{guid}", "get", selectedBIMPortalAIAguidRef.current).then(e => setProject(e))
    }, [override]);


    return (<div style={{
        background: 'white',
        padding: 16,
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb'
    }}>
        <div style={{fontWeight: 600, fontSize: 14, color: '#1f2937', marginBottom: 12}}>BIMPortal Connection</div>
        {authenticated ? (<select onChange={(e) => {
            selectedBIMPortalAIAguidRef.current = e.target.value
        }}>
            {choices.map(e => (<option value={e.guid}>{e.name}</option>))}
        </select>) : override && project ?
            <>
                <p>{project.name}</p>
                <p>{project.description}</p>
            </> :
            (<><p style={{fontWeight: 600, fontSize: 12, color: '#1f2937', marginBottom: 12}}>BIM Portal Login</p>
                <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const mail = fd.get("mail") as string | undefined
                    const password = fd.get("password") as string | undefined
                    const guid = fd.get("guid") as string | undefined
                    if (guid) {
                        selectedBIMPortalAIAguidRef.current = guid;
                        setOverride(true);
                        return;
                    }
                    if (!mail || !password) return;
                    login(mail, password)
                }} style={{display: "block"}}>
                    <input style={{display: "block"}} type="email" name="mail" placeholder="user@example.com"/>
                    <div style={{margin: ".5rem"}}/>
                    <input style={{display: "block"}} type="password" name="password" placeholder="password"/>
                    <p>or</p>
                    <input style={{display: "block"}} type="text" placeholder="AIA GUID" name="guid"/>
                    <button style={{
                        borderRadius: 6,
                        background: '#10b981',
                        color: 'white',
                        padding: '8px 12px',
                        display: 'flex',
                        gap: 6,
                        alignItems: 'center',
                        fontWeight: 500,
                        fontSize: 14,
                        border: 'none',
                        cursor: 'pointer',
                        marginTop: ".5rem",
                    }}>Submit
                    </button>
                </form>
            </>)}
    </div>)
}

export default BIMPortalSelectComponent;