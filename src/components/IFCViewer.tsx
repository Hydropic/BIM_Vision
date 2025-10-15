import React, {FC, useEffect, useRef, useState } from "react";
import * as OBC from "@thatopen/components";
import * as OBCF from "@thatopen/components-front";
import * as BUIC from "@thatopen/ui-obc";
import * as THREE from "three";
import * as BUI from "@thatopen/ui";
import { render } from "react-dom";
import { Element } from '../types';
import { useProperties } from "../utils/PropertiesContext";
import { IdsRequest, runIDSCheck } from "../ValidationReport";
interface IFCViewerProps {
  setElementsIFC: (elements: Element[]) => void;
  onComponentsReady?: (components: OBC.Components) => void;
  onRunRuleCheck?: (components: OBC.Components) => void;
}

export const buiGridContainerRef = React.createRef<HTMLDivElement>();
export const fileInputRef = React.createRef<HTMLInputElement>(); 
const IFCViewer: FC<IFCViewerProps> = ({ setElementsIFC, onComponentsReady, onRunRuleCheck }) => {
    const fileRef = useRef<File | null>(null);
    const worldRef = useRef<OBC.World>(null);
    const modelIDRef = useRef<number | null>(null);
    const fragmentIfcLoaderRef = useRef<OBC.IfcLoader>(null);
    const fragmentsRef = useRef<OBC.FragmentsManager>(null);
    const buiPanelRef = useRef<HTMLDivElement>(null);
    const highlighterRef = useRef<OBCF.Highlighter>(null);
    const { properties, components: componentsRef, viewport: viewportRef, update } = useProperties();
    const runRuleCheck = async () => {
        const idsXML = await IdsRequest("/aia/api/v1/public/aiaProject/{guid}/IDS", "0f025453-562a-489f-9e4c-58b675128f85");
        if (!idsXML) return alert("IDS XML could not be loaded");
        const resultGUID = await runIDSCheck(componentsRef.current, idsXML);
        colorModel(resultGUID.pass, resultGUID.fail);


    };
    const initializeWorld = async (container: HTMLElement | null) => {
        const viewport = document.createElement("bim-viewport");
        const components = new OBC.Components();
        const worlds = components.get(OBC.Worlds);
        const world = worlds.create();
        world.scene = new OBC.SimpleScene(components);
        // Add lights to the scene
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);

        // @ts-ignore
        world.scene.three.add(ambientLight);
        // @ts-ignore
        world.scene.three.add(directionalLight);
        const rendererComponent = new OBC.SimpleRenderer(components, container);
        world.renderer = rendererComponent;

        const cameraComponent = new OBC.OrthoPerspectiveCamera(components);
        world.camera = cameraComponent
        world.camera.controls.setLookAt(74, 16, 0.2, 30, -4, 27);

        viewport.addEventListener("resize", () => {
            rendererComponent.resize();
            cameraComponent.updateAspect();
        });
        viewportRef.current = viewport;
        components.init();
        if (onComponentsReady) {
            onComponentsReady(components);
            console.log("Components ready and passed to parent");
        }
        componentsRef.current = components;
        const grids = components.get(OBC.Grids);
        grids.create(world);

        const fragments = components.get(OBC.FragmentsManager);
        console.log("fragments: ", fragments);
        const githubUrl =
            "https://thatopen.github.io/engine_fragment/resources/worker.mjs";
        const fetchedUrl = await fetch(githubUrl);
        const workerBlob = await fetchedUrl.blob();
        const workerFile = new File([workerBlob], "worker.mjs", {
            type: "text/javascript",
        });
        const workerUrl = URL.createObjectURL(workerFile);
        await fragments.init(workerUrl);
        viewport.addEventListener("resize", () => {
            rendererComponent.resize();
            cameraComponent.updateAspect();
        });
        world.camera.controls.addEventListener("rest", () =>
            fragments.core.update(true),
        );
        console.log("Fragments: ", fragments)
        fragmentsRef.current = fragments;
        const fragmentIfcLoader = components.get(OBC.IfcLoader);
        await fragmentIfcLoader.setup({
            autoSetWasm: false,
            wasm: {
                path: "https://unpkg.com/web-ifc@0.0.71/",
                absolute: true,
            }
        })
        worldRef.current = world;
        fragmentIfcLoaderRef.current = fragmentIfcLoader;

        // Ensures that once the Fragments model is loaded
        // (converted from the IFC in this case),
        // it utilizes the world camera for updates
        // and is added to the scene.
        fragments.list.onItemSet.add(({ value: model }) => {
            console.log("here");

            // @ts-ignore
            model.useCamera(world.camera.three);
            world.scene.three.add(model.object);
            fragments.core.update(true);
        });
        const highlighter = components.get(OBCF.Highlighter);
        highlighterRef.current = highlighter;
        highlighter.setup({
            world,
            selectMaterialDefinition: {
                // you can change this to define the color of your highligthing
                color: new THREE.Color("#bcf124"),
                opacity: 1,
                transparent: false,
                renderedFaces: 0,
            },
        });
        console.log("Highlighter events: ", highlighter.events);
        highlighter.events.select.onHighlight.add(async (modelIdMap) => {
            console.log("modelIdMap: ", modelIdMap);
            const test: Record<string, Set<number>> = {
            "ifc": new Set([26021]),
            };
            console.log("test", test);
            console.log("Something was selected");

            const promises = [];
            for (const [modelId, localIds] of Object.entries(modelIdMap)) {
                const model = fragments.list.get(modelId);
                if (!model) continue;
                promises.push(model.getItemsData([...localIds]));
            }

            const data = (await Promise.all(promises)).flat();
            console.log("model data: ", data);
        });



        highlighter.events.select.onClear.add(() => {
            console.log("Selection was cleared");
        });

        // Create properties table
        BUI.Manager.init();
        const [propertiesTable, updatePropertiesTable] = BUIC.tables.itemsData({
            components,
            modelIdMap: {},
        });
        propertiesTable.preserveStructureOnFilter = true;
        propertiesTable.indentationInText = false;
        properties.current = propertiesTable;
        highlighter.events.select.onHighlight.add((modelIdMap) => {
            console.log(update);
            
            updatePropertiesTable({ modelIdMap });
            update.current()
        });

        highlighter.events.select.onClear.add(() => {
            updatePropertiesTable({ modelIdMap: {} })
            update.current()
        });

    };

    const loadIfc = async (file, loader: OBC.IfcLoader) => {
        try {
            console.log("Loading file:", file);
            const data = await file.arrayBuffer();
            const buffer = new Uint8Array(data);
            console.log("Buffer length:", buffer.length);
            if (buffer.length === 0) {
                throw new Error("Empty buffer");
            }
            const model = await loader.load(buffer, false, "ifc", {
                processData: {
                    progressCallback: (progress) => console.log(progress),
                },
            });
        } catch (error) {
            console.error("Error loading IFC model:", error);
        }
    };
    const colorModel = async (passed, failed) => {
        const fragments = fragmentsRef.current;
        const components = componentsRef.current;
        console.log("Fragments: ", fragments.guidsToModelIdMap(["23VTROq_T7XuNLbHWQs_3z"]));
        const green = await fragments.guidsToModelIdMap(passed);
        const red = await fragments.guidsToModelIdMap(failed);
        const highlighter = components.get(OBCF.Highlighter);
        if (!highlighter || !highlighter.events || !highlighter.events.select) {
            console.warn("Highlighter not set up yet.");
            return;
        }
         // Define custom styles for selections
        highlighter.styles.set("red", {
            color: new THREE.Color("#ef4444"),
            opacity: 1,
            transparent: false,
            renderedFaces: 0,
        });
        highlighter.styles.set("green", {
            color: new THREE.Color("#22c55e"),
            opacity: 1,
            transparent: false,
            renderedFaces: 0,
        });
        highlighter.styles.set("yellow", {
            color: new THREE.Color("#facc15"),
            opacity: 1,
            transparent: false,
            renderedFaces: 0,
        });
            

        const yellow: Record<string, Set<number>> = {
        "ifc": new Set([26131]),
        };
        // Use highlightByID for each model with a unique name and color
        highlighterRef.current;
        await highlighterRef.current.highlightByID(
            "red",
            red,
            true, // don't remove previous highlights
            false, // don't zoom to selection
            null,  // no exclusions
            false, // not picking
        );
        await highlighterRef.current.highlightByID(
            "green",
            green,
            true, // don't remove previous highlights
            false, // don't zoom to selection
            null,  // no exclusions
            false, // not picking
        );
        await highlighterRef.current.highlightByID(
            "yellow",
            yellow,
            true, // don't remove previous highlights
            false, // don't zoom to selection
            null,  // no exclusions
            false, // not picking
        );
        
    };
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            console.log("File selected:", selectedFile);
            fileRef.current = selectedFile;
            if (worldRef.current && fragmentIfcLoaderRef.current) {
                loadIfc(selectedFile, fragmentIfcLoaderRef.current);
            }

        }
    };
    useEffect(() => {
        const container = document.getElementById("container");
        if (container) {
            initializeWorld(container);
        }
    }, []);

    return (
        <div className="ifc-viewer">
            <div id="container" style={{ width: "100%", height: "500px" }} />
            <input
                type="file"
                accept=".ifc"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />
            {/* INPUT FILE UPLOAD IS DEFINED IN MODELVIEWER*/}
            <button onClick={runRuleCheck}>Color Model</button>
        </div>
    );
};

export default IFCViewer;