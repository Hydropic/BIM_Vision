import { makeBIMPortalRequest } from '../BIMPortal/api';
import { Element, AIRecommendation, Issue } from '../types';

export async function mockLLMExplain(element: Element): Promise<string> {
  if (!element) return "Element not found.";
  await new Promise((r) => setTimeout(r, 300));
  return `Kurz erklärt: ${element.id} ist ein ${element.type}. ${
    element.status === "pass"
      ? "Alle Pflichtangaben sind vorhanden."
      : element.status === "warn"
      ? "Einige Angaben fehlen. Bitte ergänzen Sie fehlende Eigenschaften wie Brandschutzklasse oder U-Wert."
      : "Wesentliche Angaben fehlen. Das kann Genehmigungen verhindern und zu Verzögerungen führen."
  }`;
}

export async function LLMExplain(api_key: string, element: Element, resultsCheck: any = ""): Promise<string> {
  if (!api_key) {
    console.warn('No OpenAI API key provided, falling back to mock explanation');
    return mockLLMExplain(element);
  }

  try {
    const idsData = await makeBIMPortalRequest("/aia/api/v1/public/aiaProject/{guid}/IDS", "get", element.guid);
    
    console.log('IDS Data received:', idsData); 
    
    let context = '';
    
    if (idsData) {
      if (typeof idsData === 'string') {
        context = parseIDSForElement(idsData, element.type);
        console.log('Parsed IDS requirements:', context);
      } else if (typeof idsData === 'object') {
        context = `IDS Requirements (Structured):\n${JSON.stringify(idsData, null, 2)}`;
      }
    } else {
      context = 'No IDS data available for this element from BIM Portal.';
    }

    
    let validationContext = '';
    if (resultsCheck && (resultsCheck.failed || resultsCheck.passed)) {
      const elementId = element.id;
      const elementGuid = element.guid;
      
      const failedSpecs = resultsCheck.failed ? resultsCheck.failed.filter((spec: any) => 
        spec.guids.includes(elementId) || spec.guids.includes(elementGuid)
      ) : [];
      
      const passedSpecs = resultsCheck.passed ? resultsCheck.passed.filter((spec: any) => 
        spec.guids.includes(elementId) || spec.guids.includes(elementGuid)
      ) : [];
      
      if (failedSpecs.length > 0 || passedSpecs.length > 0) {
        validationContext = `\n\nIDS Validation Results for this Element:\n`;
        
        if (failedSpecs.length > 0) {
          validationContext += `FAILED SPECIFICATIONS:\n`;
          failedSpecs.forEach((spec: any) => {
            validationContext += `- ${spec.name}: ${spec.description || 'No description'}\n`;
          });
        }
        
        if (passedSpecs.length > 0) {
          validationContext += `PASSED SPECIFICATIONS:\n`;
          passedSpecs.forEach((spec: any) => {
            validationContext += `- ${spec.name}: ${spec.description || 'No description'}\n`;
          });
        }
        
        validationContext += `\nValidation Summary: ${failedSpecs.length} failed, ${passedSpecs.length} passed specifications for this element.\n`;
      } else {
        validationContext = '\n\nNo IDS validation results found for this element.\n';
      }
    }

    const prompt = `Du bist ein BIM-Experte für deutsche Bauvorschriften. Analysiere dieses BIM-Element:

                    Element Information:
                    - ID: ${element.id}
                    - Typ: ${element.type}
                    - Eigenschaften: ${JSON.stringify(element.props, null, 2)}
                    - Status: ${element.status}

                    context: ${context}

                    validationContext: ${validationContext}

                    Bitte erkläre:
                    1. Um was für einen Gegenstand haltet es sich?
                    2. Was bedeutet der aktuelle Status des Elements?
                    3. Welche Anforderungen ergeben sich aus den IDS-Daten?
                    4. Welche Eigenschaften fehlen oder sind falsch?

                    Antworte auf Deutsch und beziehe dich auf deutsche Baustandards. Gib eine detaillierte Analyse. Limitier deine Antwort auf maximal 50 Wörter!`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Du bist ein deutscher BIM-Experte mit Spezialisierung auf Bauvorschriften und IDS-Analyse. Gib detaillierte technische Erklärungen auf Deutsch.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Keine Antwort generiert';

  } catch (error) {
    console.error('LLM explanation failed:', error);
  }
}

export function parseIDSForElement(idsXml: string, elementType: string): string {
  if (!idsXml || typeof idsXml !== 'string') return '';
  elementType = "Wall"
  const requirements: string[] = [];
  
  const specMatches = idsXml.match(/<specification[^>]*>([\s\S]*?)<\/specification>/g);
  
  if (specMatches) {
    for (const spec of specMatches) {
      const isRelevant = checkSpecificationRelevance(spec, elementType);
      if (!isRelevant) continue;
      
      const nameMatch = spec.match(/name="([^"]*)"/);
      const specName = nameMatch ? nameMatch[1] : 'Unknown';
      
      const propertyMatches = spec.match(/<property[^>]*>([\s\S]*?)<\/property>/g);
      
      if (propertyMatches) {
        const specRequirements: string[] = [];
        
        for (const prop of propertyMatches) {
          const propertyInfo = extractPropertyInfo(prop);
          if (propertyInfo) {
            specRequirements.push(`  • ${propertyInfo}`);
          }
        }
        
        if (specRequirements.length > 0) {
          requirements.push(`${specName}:`);
          requirements.push(...specRequirements);
        }
      }
    }
  }
  
  return requirements.length > 0 
    ? `Relevante IDS Anforderungen:\n${requirements.join('\n')}`
    : `Keine spezifischen IDS Anforderungen für ${elementType} gefunden.`;
}

function checkSpecificationRelevance(specification: string, elementType: string): boolean {
  const entityMatch = specification.match(/<name>\s*<simpleValue>([^<]*)<\/simpleValue>\s*<\/name>/);
  
  if (!entityMatch) return false;
  
  const ifcEntity = entityMatch[1].toLowerCase();
  
  const elementMappings = {
    'Wall': ['ifcwall', 'ifcslab'],
    'Door': ['ifcdoor'],
    'Column': ['ifccolumn'],
    'Window': ['ifcwindow'],
    'Roof': ['ifcroof'],
    'Slab': ['ifcslab']
  };
  
  const relevantEntities = elementMappings[elementType as keyof typeof elementMappings] || [];
  
  return relevantEntities.some(entity => 
    ifcEntity.includes(entity.toLowerCase())
  );
}

function extractPropertyInfo(propertyXml: string): string | null {
  try {
    const propertySetMatch = propertyXml.match(/<propertySet>\s*<simpleValue>([^<]*)<\/simpleValue>\s*<\/propertySet>/);
    
    const baseNameMatch = propertyXml.match(/<baseName>\s*<simpleValue>([^<]*)<\/simpleValue>\s*<\/baseName>/);
    
    const cardinalityMatch = propertyXml.match(/cardinality="([^"]*)"/);
    
    if (!baseNameMatch) return null;
    
    const baseName = baseNameMatch[1];
    const cardinality = cardinalityMatch ? cardinalityMatch[1] : '';
    const isRequired = cardinality === 'required';
    
    let requirement = baseName;
    if (isRequired) {
      requirement += ' (erforderlich)';
    }
    
    return requirement;
  } catch (error) {
    console.warn('Error parsing property info:', error);
    return null;
  }
}

export async function getAILLMRecommendations(api_key: string, element: Element, analysis: string, resultsCheck: any = ""): Promise<AIRecommendation | null> {
    if (!element || !api_key) return null;

    const MAX_RETRIES = 10;
    
    let contextInfo = analysis;

    // If analysis is empty or very short, fetch IDS data for context
    if (!analysis || analysis.trim().length < 20) {
        contextInfo = await LLMExplain(api_key, element, resultsCheck)
    }
    
    // Add validation context for recommendations
    let validationContext = '';
    if (resultsCheck && (resultsCheck.failed || resultsCheck.passed)) {
      const elementId = element.id;
      const elementGuid = element.guid;
      
      const failedSpecs = resultsCheck.failed ? resultsCheck.failed.filter((spec: any) => 
        spec.guids.includes(elementId) || spec.guids.includes(elementGuid)
      ) : [];
      
      const passedSpecs = resultsCheck.passed ? resultsCheck.passed.filter((spec: any) => 
        spec.guids.includes(elementId) || spec.guids.includes(elementGuid)
      ) : [];
      
      if (failedSpecs.length > 0 || passedSpecs.length > 0) {
        validationContext = `\n\nIDS Validation Results for this Element:\n`;
        
        if (failedSpecs.length > 0) {
          validationContext += `FAILED SPECIFICATIONS:\n`;
          failedSpecs.forEach((spec: any) => {
            validationContext += `- ${spec.name}: ${spec.description || 'No description'}\n`;
          });
        }
        
        if (passedSpecs.length > 0) {
          validationContext += `PASSED SPECIFICATIONS:\n`;
          passedSpecs.forEach((spec: any) => {
            validationContext += `- ${spec.name}: ${spec.description || 'No description'}\n`;
          });
        }
        
        validationContext += `\nValidation Summary: ${failedSpecs.length} failed, ${passedSpecs.length} passed specifications for this element.\n`;
      }
    }
    
    const prompt = `Als BIM-Experte, analysiere dieses Element und generiere konkrete Lösungsvorschläge:

                    Element: ${element.id} (${element.type})
                    Aktuelle Eigenschaften: ${JSON.stringify(element.props)}
                    Status: ${element.status}

                    Kontext/Analyse: ${contextInfo}
                    
                    validationContext: ${validationContext}

                    Generiere 2-4 konkrete Lösungsvorschläge im JSON Format. WEICH NICHT VON DIESEM OUTPUT AB. NUR JSON OUTPUT SONST NICHTS:
                    {
                    "suggestions": [
                        {
                        "property": "eigenschaftsname",
                        "label": "Deutsche Beschreibung",
                        "options": [
                            {"value": "wert1", "reason": "Kurze Begründung"},
                            {"value": "wert2", "reason": "Kurze Begründung"}
                        ]
                        }
                    ]
                    }

                    Fokussiere auf fehlende/falsche Eigenschaften. Verwende deutsche Begriffe.`;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${api_key}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'Du bist ein deutscher BIM-Experte. Antworte nur mit gültigem JSON ohne zusätzlichen Text.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 300,
                    temperature: 0.2
                })
            });

            if (!response.ok) {
                console.error('OpenAI API error for recommendations:', response.status);
                continue; // Try again
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content;
            
            if (!content) {
                continue; // Try again
            }

            try {
                console.log(content)
                const parsed = JSON.parse(content);
                return {
                    analysis: contextInfo,
                    suggestions: parsed.suggestions || []
                };
            } catch (parseError) {
                console.warn(`Failed to parse LLM JSON response on attempt ${attempt}, trying again...`);
                // Continue to next attempt
            }

        } catch (error) {
            console.error(`LLM request failed on attempt ${attempt}:`, error);
            // Continue to next attempt
        }
    }
    
    // All attempts failed
    console.warn('All LLM attempts failed, returning null');
    return null;
}

export async function getAIFixRecommendations(element: Element): Promise<AIRecommendation | null> {
  if (!element) return null;
  
  await new Promise((r) => setTimeout(r, 800));
  
  let recommendations: AIRecommendation = {
    analysis: "",
    suggestions: []
  };

  if (element.type === "Wall") {
    const missingUValue = !element.props.UValue;
    const missingFireClass = !element.props.fireClass;
    
    if (missingUValue && missingFireClass) {
      recommendations.analysis = `Wall ${element.id} is missing both thermal insulation (U-Value) and fire protection properties. Based on typical residential construction standards, I recommend:`;
      recommendations.suggestions = [
        {
          property: "UValue",
          label: "U-Value (W/m²K)",
          options: [
            { value: 0.18, reason: "Passive house standard - excellent insulation" },
            { value: 0.25, reason: "Modern building code compliance" },
            { value: 0.35, reason: "Standard insulation requirement" }
          ]
        },
        {
          property: "fireClass",
          label: "Fire Resistance Class",
          options: [
            { value: "F90", reason: "High-rise or critical structural element" },
            { value: "F60", reason: "Standard residential/commercial" },
            { value: "F30", reason: "Non-load bearing partition" }
          ]
        }
      ];
    } else if (missingUValue) {
      recommendations.analysis = `Wall ${element.id} needs thermal insulation specification. Based on the existing fire class ${element.props.fireClass}, this appears to be a structural element.`;
      recommendations.suggestions = [
        {
          property: "UValue",
          label: "U-Value (W/m²K)",
          options: [
            { value: 0.18, reason: "Energy-efficient standard" },
            { value: 0.25, reason: "Building code minimum" },
            { value: 0.30, reason: "Basic compliance" }
          ]
        }
      ];
    } else if (missingFireClass) {
      recommendations.analysis = `Wall ${element.id} has good thermal properties (U-Value: ${element.props.UValue}) but needs fire resistance classification.`;
      recommendations.suggestions = [
        {
          property: "fireClass",
          label: "Fire Resistance Class",
          options: [
            { value: "F60", reason: "Recommended for this U-Value range" },
            { value: "F30", reason: "Minimum for partition walls" },
            { value: "F90", reason: "If load-bearing or escape route" }
          ]
        }
      ];
    }
  } else if (element.type === "Door") {
    recommendations.analysis = `Door ${element.id} requires fire resistance rating for building code compliance. Based on typical door applications:`;
    recommendations.suggestions = [
      {
        property: "fireClass",
        label: "Fire Resistance Class",
        options: [
          { value: "F30", reason: "Standard interior door" },
          { value: "F60", reason: "Fire compartment separation" },
          { value: "F90", reason: "Emergency exit or high-risk area" }
        ]
      }
    ];
  }

  return recommendations;
}

export function calculateElementStatus(element: Element): Element['status'] {
  let status: Element['status'] = "pass";
  
  if (element.type === "Wall") {
    if (!element.props.UValue && !element.props.fireClass) status = "fail";
    else if (!element.props.UValue || !element.props.fireClass) status = "warn";
  } else if (element.type === "Door") {
    if (!element.props.fireClass) status = "warn";
  }
  
  return status;
}

export function applyAISuggestionToElement(
  elements: Element[], 
  selectedId: string, 
  property: string, 
  value: string | number
): Element[] {
  return elements.map((element) => {
    if (element.id === selectedId) {
      const updatedProps = { ...element.props, [property]: value };
      const newStatus = calculateElementStatus({ ...element, props: updatedProps });
      return { ...element, props: updatedProps, status: newStatus };
    }
    return element;
  });
}

export function manualFixElement(element: Element): { props: any; fixed: boolean } {
  let updatedProps = { ...element.props };
  let fixed = false;

  if (element.type === "Wall") {
    if (!element.props.UValue) {
      const uValue = prompt("Enter U-Value for wall (e.g., 0.25):");
      if (uValue && !isNaN(parseFloat(uValue))) {
        updatedProps.UValue = parseFloat(uValue);
        fixed = true;
      }
    }
    if (!element.props.fireClass) {
      const fireClass = prompt("Enter Fire Class (e.g., F30, F60, F90):");
      if (fireClass) {
        updatedProps.fireClass = fireClass;
        fixed = true;
      }
    }
  } else if (element.type === "Door") {
    if (!element.props.fireClass) {
      const fireClass = prompt("Enter Fire Class for door (e.g., F30, F60):");
      if (fireClass) {
        updatedProps.fireClass = fireClass;
        fixed = true;
      }
    }
  }

  return { props: updatedProps, fixed };
}

export function runElementRuleCheck(elements: Element[]): Element[] {
  return elements.map((el) => {
    const status = calculateElementStatus(el);
    return { ...el, status };
  });
}
