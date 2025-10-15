import React, {MutableRefObject, useEffect, useRef, useState} from 'react';
import { Element, Issue, AIRecommendation } from '../types';
import { IconAlert, IconBrain, IconCheck, IconDatabase, IconMessage, IconSend, IconTool } from '../Icons';
import { buiGridContainerRef } from './IFCViewer';
import { useProperties } from '../utils/PropertiesContext';
import * as BUI from "@thatopen/ui";
import * as BUIC from "@thatopen/ui-obc";
import { fileInputRef } from './IFCViewer';
import BIMPortalSelect from "./BIMPortalSelect";

interface SidebarProps {
  selectedId: string | null;
  elements: Element[];
  issues: Issue[];
  llmText: string;
  aiRecommendations: AIRecommendation | null;
  loadingRecommendations: boolean;
  loadingAIIssue: boolean;
  onExplain: (element: Element) => void;
  onAddIssue: (title: string, description: string) => void;
  onGetAIRecommendations: (element: Element) => void;
  onApplyAISuggestion: (property: string, value: string | number) => void;
  onFixElement: (elementId: string) => void;
  onCreateAIIssue: (element: Element) => void;
  onAddElement: (element: Element[]) => void; // New prop to add element to the elements array
  aiaRef: MutableRefObject<string | null>;
  resultsCheck: any;
}

const Sidebar: React.FC<SidebarProps> = ({
  selectedId,
  elements,
  issues,
  llmText,
  aiRecommendations,
  loadingRecommendations,
  loadingAIIssue,
  onExplain,
  onAddIssue,
  onGetAIRecommendations,
  onApplyAISuggestion,
  onFixElement,
  onCreateAIIssue,
  onAddElement, // New prop to add element to the elements array
  aiaRef,
  resultsCheck
}) => {
  const [selectedElement, setSelectedElement] = useState<Element>(null);
  let seletecId = "nothing"
  const processedElementsRef = useRef<Set<string>>(new Set());
  const lastPropertiesRef = useRef<any>(null);
  const { properties, components, viewport: viewportRef, update } = useProperties();

  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedElement && resultsCheck) {
        let elementStatus: "pass" | "warn" | "fail" = "pass";
        let elementColor = 0x00ff00;
        
        if (resultsCheck.failed) {
          const failedSpecs = resultsCheck.failed.filter((spec: any) => 
            spec.guids.includes(selectedElement.id)
          );
          
          const failCount = failedSpecs.length;
          
          if (failCount >= 3) {
            elementStatus = "fail";
            elementColor = 0xff0000;
          } else if (failCount > 0) {
            elementStatus = "warn";
            elementColor = 0xffaa00;
          }
        }
        
        // Update the selected element with new status
        const updatedElement = {
          ...selectedElement,
          status: elementStatus,
          color: elementColor
        };
        
        setSelectedElement(updatedElement);
        
        // Also update the elements array
        onAddElement([updatedElement]);
      }
    }, 100); // Run every 2 seconds

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [selectedElement, resultsCheck]); // No dependencies - runs once and continues every 2 seconds

  useEffect(() =>
    // 
     update.current = () => {
      const propertiesPanel = BUI.Component.create(() => {
        
        if (!properties.current) return BUI.html`<div>Click a model to view properties</div>`;
        
        if (properties.current) {
          console.log("Properties changed, processing...");
          lastPropertiesRef.current = properties.current;
          
          if (properties.current._data && properties.current._data.length === 0) {
            
            if (typeof properties.current.requestUpdate === 'function') {
              console.log("Calling requestUpdate...");
              properties.current.requestUpdate();
            }
            
            console.log("Checking for alternative data sources...");
            console.log("dataTransform:", properties.current.dataTransform);
            
            const tableContent = properties.current.innerHTML;
            console.log("Table innerHTML:", tableContent);
            
            setTimeout(() => {
              console.log("After timeout - _data:", properties.current._data);
              if (properties.current._data && properties.current._data.length > 0) {
                console.log("Data loaded after timeout!");
                if (update.current) {
                  update.current()
                }
              }
            }, 100);
            
            return BUI.html`<div>Waiting for properties to load...</div>`;
          }
          console.log("helllloo")
          const propertiesData = Object.create(null);
          let elementType = "IFC Element";
          let localId = selectedId;
          let guid;
          console.log(properties.current._data)
          if (properties.current._data && properties.current._data.length > 0) {
            
            properties.current._data.forEach((item: any, index: number) => {
              
              
              if (item.data) {
                Object.entries(item.data).forEach(([key, value]) => {
                  
                  propertiesData[key] = value;
                });
              }
              
              if (item.children && Array.isArray(item.children)) {
                item.children.forEach((child: any, childIndex: number) => {
                  if (child.data && child.data.Name && child.data.Value) {
                    const propertyName = child.data.Name;
                    const propertyValue = child.data.Value;
                    
                    propertiesData[propertyName] = propertyValue;
                    
                    if (propertyName === "Category") {
                      elementType = propertyValue || "IFC Element";
                    } else if (propertyName === "Type" || propertyName === "IfcType") {
                      elementType = propertyValue || elementType || "IFC Element";
                    }
                    
                    if (propertyName === "Guid") {
                      localId = propertyValue;
                    }
                  }
                  
                  if (child.children && Array.isArray(child.children)) {
                    child.children.forEach((nestedChild: any) => {
                      if (nestedChild.data && nestedChild.data.Name && nestedChild.data.Value) {
                        const nestedName = nestedChild.data.Name;
                        const nestedValue = nestedChild.data.Value;
                        propertiesData[nestedName] = nestedValue;
                        
                        if (nestedName === "Category") {
                          elementType = nestedValue || "IFC Element";
                        } else if (nestedName === "Type" || nestedName === "IfcType") {
                          elementType = nestedValue || elementType || "IFC Element";
                        }
                        
                        if (nestedName === "Guid") {
                          localId = nestedValue;
                          guid = nestedValue
                        }
                      }
                      
                      if (nestedChild.children && Array.isArray(nestedChild.children)) {
                        nestedChild.children.forEach((deepChild: any) => {
                          if (deepChild.data && deepChild.data.Name && deepChild.data.Value) {
                            const deepName = deepChild.data.Name;
                            const deepValue = deepChild.data.Value;
                            if (deepName == "Category") {
                              let t = 1;
                            }  else {
                              propertiesData[deepName] = deepValue;
                            }
                          }
                        });
                      }
                    });
                  }
                });
              }
            });
          }
          
          selectedId = localId
          
          let elementStatus: "pass" | "warn" | "fail" = "pass";
          let elementColor = 0x00ff00;
          
          console.log("results:", resultsCheck)
          
          if (resultsCheck && resultsCheck.failed) {
            const failedSpecs = resultsCheck.failed.filter((spec: any) => 
              spec.guids.includes(localId)
            );
            
            const failCount = failedSpecs.length;
            console.log(`Element ${localId} has ${failCount} failed specifications`);
            
            if (failCount >= 3) {
              elementStatus = "fail";
              elementColor = 0xff0000;
            } else if (failCount > 0) {
              elementStatus = "warn";
              elementColor = 0xffaa00;
            }
          }

          const new_element = {
            id: localId,
            type: elementType,
            props: propertiesData,
            status: elementStatus,
            color: elementColor,
            guid: "0f025453-562a-489f-9e4c-58b675128f85",
          };
          
          console.log(new_element)
          
          onAddElement([new_element]);
          setSelectedElement(new_element);
        }
        
        const [loadFragBtn] = BUIC.buttons.loadFrag({ components: components.current });

        const onTextInput = (e: Event) => {
          const input = e.target as BUI.TextInput;
          properties.current.queryString = input.value !== "" ? input.value : null;
        };

        const expandTable = (e: Event) => {
          const button = e.target as BUI.Button;
          properties.current.expanded = !properties.current.expanded;
          button.label = properties.current.expanded ? "Collapse" : "Expand";
        };

        const copyAsTSV = async () => {
          await navigator.clipboard.writeText(properties.current.tsv);
        };

        return BUI.html`
      <bim-panel label="Properties">
        <bim-panel-section label="Element Data">
          <div style="display: flex; gap: 0.5rem;">
            <bim-button @click=${expandTable} label=${properties.current.expanded ? "Collapse" : "Expand"}></bim-button> 
          </div> 
          <bim-text-input @input=${onTextInput} placeholder="Search Property" debounce="250"></bim-text-input>
          ${properties.current}
        </bim-panel-section>
      </bim-panel>
    `;
      });

      const app = document.createElement("bim-grid") as BUI.Grid<["main"]>;
      app.layouts = {
        main: {
          template: `
      "propertiesPanel viewport"
      /25rem 1fr
      `,
          elements: { propertiesPanel, viewport: viewportRef.current },
        },
      };

      const propertiesContainer = document.getElementById("properties-container")

      propertiesContainer.innerHTML = "";

      app.layout = "main";
      propertiesContainer.append(app);
    }, [properties.current])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Element Inspector */}
      <div style={{ background: 'white', padding: 16, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>Element Inspector</div>
          {!selectedElement ? (
            <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>No element selected</div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: '#374151' }}>ID: <span style={{ fontWeight: 500 }}>{selectedId}</span></div>
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => onExplain(selectedElement)} style={{ background: '#8b5cf6', color: 'white', borderRadius: 4, padding: '6px 10px', display: 'flex', gap: 4, alignItems: 'center', fontWeight: 500, fontSize: 12, border: 'none', cursor: 'pointer' }}>
                  <IconMessage width={12} height={12} /> Explain
                </button>
                <button onClick={() => {
                  const title = prompt('Issue title:');
                  const desc = prompt('Issue description:');
                  if (title) onAddIssue(title, desc || '');
                }} style={{ background: '#f59e0b', color: 'white', borderRadius: 4, padding: '6px 10px', display: 'flex', gap: 4, alignItems: 'center', fontWeight: 500, fontSize: 12, border: 'none', cursor: 'pointer' }}>
                  <IconAlert width={12} height={12} /> Issue
                </button>
                <button onClick={() => onCreateAIIssue(selectedElement)} disabled={loadingAIIssue} style={{ 
                  background: loadingAIIssue ? '#94a3b8' : '#06b6d4', 
                  color: 'white', 
                  borderRadius: 4, 
                  padding: '6px 10px', 
                  display: 'flex', 
                  gap: 4, 
                  alignItems: 'center', 
                  fontWeight: 500, 
                  fontSize: 12, 
                  border: 'none', 
                  cursor: loadingAIIssue ? 'not-allowed' : 'pointer' 
                }}>
                  <IconBrain width={12} height={12} /> {loadingAIIssue ? 'Creating...' : 'AI Issue'}
                </button>
                {selectedElement && (selectedElement.status === 'warn' || selectedElement.status === 'fail') && (
                  <>
                    <button onClick={() => onGetAIRecommendations(selectedElement)} style={{ background: '#06b6d4', color: 'white', borderRadius: 4, padding: '6px 10px', display: 'flex', gap: 4, alignItems: 'center', fontWeight: 500, fontSize: 12, border: 'none', cursor: 'pointer' }}>
                      <IconBrain width={12} height={12} /> AI Fix
                    </button>
                    <button onClick={() => onFixElement(selectedId)} style={{ background: '#10b981', color: 'white', borderRadius: 4, padding: '6px 10px', display: 'flex', gap: 4, alignItems: 'center', fontWeight: 500, fontSize: 12, border: 'none', cursor: 'pointer' }}>
                      <IconTool width={12} height={12} /> Manual Fix
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1f2937', marginBottom: 6 }}>Properties</div>
          {selectedElement ? (
            <div style={{ marginTop: 8, color: '#111827', fontSize: 14 }}>
              <div>Type: <strong>{selectedElement.type}</strong></div>
              <div>Status: <strong style={{ color: selectedElement.status === 'pass' ? '#16A34A' : selectedElement.status === 'warn' ? '#B45309' : '#C2410C' }}>{selectedElement.status}</strong></div>
            </div>
          ) : (
            <div style={{ color: '#6B7280', marginTop: 8 }}>Select an element to view properties</div>
          )}
        </div>

        <div id="properties-container" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6', maxHeight: "50vh", overflow: "auto" }}>
          {/* Element Properties */}

        </div>
      </div>

      {/* AI Analysis */}
      {llmText && (
        <div style={{ background: 'white', padding: 16, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#1f2937', marginBottom: 8 }}>AI Analysis</div>
          <div style={{ color: '#374151', fontSize: 13, lineHeight: 1.5, padding: '8px 12px', background: '#f8fafc', borderRadius: 4, border: '1px solid #e5e7eb' }}>{llmText}</div>
        </div>
      )}

      {/* AI Recommendations */}
      {aiRecommendations && (
        <div style={{ background: 'white', padding: 16, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <IconBrain width={16} height={16} style={{ color: '#06b6d4' }} />
            <div style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>AI Fix Recommendations</div>
          </div>

          {loadingRecommendations ? (
            <div style={{ color: '#6b7280', fontSize: 13, padding: '12px 0' }}>Analyzing element context...</div>
          ) : (
            <>
              <div style={{ color: '#374151', fontSize: 13, lineHeight: 1.5, marginBottom: 16, padding: '8px 12px', background: '#f0f9ff', borderRadius: 4, border: '1px solid #e0f2fe' }}>
                {aiRecommendations.analysis}
              </div>

              {aiRecommendations.suggestions.map((suggestion, idx) => (
                <div key={idx} style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 500, fontSize: 12, color: '#1f2937', marginBottom: 8 }}>{suggestion.label}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {suggestion.options.map((option, optIdx) => (
                      <button
                        key={optIdx}
                        onClick={() => onApplyAISuggestion(suggestion.property, option.value)}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e5e7eb',
                          borderRadius: 6,
                          padding: '8px 12px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontSize: 12
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f0f9ff';
                          e.currentTarget.style.borderColor = '#06b6d4';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#f8fafc';
                          e.currentTarget.style.borderColor = '#e5e7eb';
                        }}
                      >
                        <div style={{ fontWeight: 500, color: '#1f2937', marginBottom: 2 }}>
                          {option.value} {suggestion.property === 'UValue' ? 'W/m²K' : ''}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: 11 }}>{option.reason}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Issues */}
      <div style={{ background: 'white', padding: 16, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#1f2937', marginBottom: 12 }}>Issues ({issues.length})</div>
        {issues.length === 0 ? (
          <div style={{ color: '#6B7280', fontSize: 13 }}>No issues created yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {issues.map((issue) => (
              <div key={issue.id} style={{ padding: 12, border: '1px solid #fef3c7', borderRadius: 6, background: '#fffbeb' }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: '#1f2937' }}>{issue.title}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                  #{issue.elementId} • {new Date(issue.createdAt).toLocaleDateString()}
                </div>
                {issue.description && (
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 6 }}>{issue.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

        <BIMPortalSelect selectedBIMPortalAIAguidRef={aiaRef} />
      
    </div>
  );
};

export default Sidebar;
