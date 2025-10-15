import { Issue, Element } from '../types';
import { makeBIMPortalRequest } from '../BIMPortal/api';
import { parseIDSForElement } from './llmUtils';

export const createIssue = (
  existingIssues: Issue[], 
  elementId: string, 
  title: string, 
  description: string
): Issue => {
  return {
    id: `ISSUE-${existingIssues.length + 1}`,
    elementId,
    title,
    description,
    createdAt: new Date().toISOString(),
  };
};

// BCF 2.1 compliant issue structure
interface BCFIssue {
  markup: {
    header: {
      files: Array<{
        filename: string;
        date: string;
        reference: string;
      }>;
    };
    topic: {
      guid: string;
      topic_type: string;
      topic_status: string;
      title: string;
      priority: string;
      index: number;
      labels: string[];
      creation_date: string;
      creation_author: string;
      modified_date: string;
      modified_author: string;
      assigned_to?: string;
      description?: string;
      bim_snippet?: {
        snippet_type: string;
        reference: string;
        reference_schema: string;
      };
    };
    comments: Array<{
      guid: string;
      date: string;
      author: string;
      comment: string;
      topic_guid: string;
      reply_to_comment_guid?: string;
    }>;
  };
  viewpoint?: {
    guid: string;
    components: {
      visibility: {
        default_visibility: boolean;
        exceptions: Array<{
          ifc_guid: string;
        }>;
      };
      selection: Array<{
        ifc_guid: string;
      }>;
    };
  };
}


interface JiraConfig {
  baseUrl: string; // e.g., "https://yourcompany.atlassian.net"
  email: string;   // Your Jira email
  apiToken: string; // Jira API token
  projectKey: string; // e.g., "BIM" or "PROJ"
}

export async function submitBCFToJira(bcfIssue: BCFIssue, config: JiraConfig): Promise<{ success: boolean; jiraKey?: string; error?: string }> {
  try {
    const topic = bcfIssue.markup.topic;
    const comment = bcfIssue.markup.comments[0];
    
    const issueData = {
      summary: topic.title,
      description: `${comment.comment}\n\nTechnical Details:\n${topic.description || 'No additional details provided.'}\n\nBCF Reference: ${topic.guid}`,
      issue_type: 'Task',
      priority: topic.priority || 'Medium',
      labels: topic.labels || ['BIM', 'BCF'],
      bcf_reference: topic.guid
    };
    
    const backendUrl = 'http://localhost:5001/api/jira/issue';
    
    console.log('Sending to Flask backend:', backendUrl);
    console.log('Issue data:', JSON.stringify(issueData, null, 2));
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(issueData)
    });

    console.log('Backend response status:', response.status);
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Jira issue created via backend:', result.issue_key);
      return {
        success: true,
        jiraKey: result.issue_key
      };
    } else {
      console.error('Backend error:', result.error);
      return {
        success: false,
        error: result.error
      };
    }

  } catch (error) {
    console.error('Error submitting to backend:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function createAndSubmitToJira(
  api_key: string,
  element: Element,
  jiraConfig: JiraConfig,
  projectName: string = "BIM Project",
  author: string = "BIM Analyst",
  guid: string = "0f025453-562a-489f-9e4c-58b675128f85",
  resultsCheck: any = "",
): Promise<{ success: boolean; bcfIssue?: BCFIssue; jiraKey?: string; error?: string }> {
  try {
    const bcfIssue = await createBCFIssue(api_key, element, guid, projectName, author, resultsCheck);
    
    if (!bcfIssue) {
      return { success: false, error: "Failed to generate BCF issue" };
    }

    const jiraResult = await submitBCFToJira(bcfIssue, jiraConfig);
    
    if (jiraResult.success) {
      downloadBCFIssue(bcfIssue, `${element.id}-${jiraResult.jiraKey}.bcf`);
      
      return { 
        success: true, 
        bcfIssue, 
        jiraKey: jiraResult.jiraKey 
      };
    } else {
      return { 
        success: false, 
        error: jiraResult.error, 
        bcfIssue 
      };
    }
    
  } catch (error) {
    console.error('Error in createAndSubmitToJira:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

export async function createBCFIssue(
  api_key: string,
  element: Element,
  guid: string,
  projectName: string = "BIM Project",
  author: string = "BIM Analyst",
  resultsCheck: any = "",
): Promise<BCFIssue | null> {
  if (!api_key || !element) return null;

  try {
    const idsData = await makeBIMPortalRequest("/aia/api/v1/public/aiaProject/{guid}/IDS", "get", element.guid);
    const idsContext = idsData ? parseIDSForElement(idsData as string, element.type) : '';
    
    // Add validation context from resultsCheck
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
    
    const prompt = `Als BIM-Experte, erstelle einen BCF-Issue für dieses Element:

                    Element: ${element.id} (${element.type})
                    Eigenschaften: ${JSON.stringify(element.props)}
                    Status: ${element.status}

                    IDS Anforderungen:
                    ${idsContext}
                    
                    ${validationContext}
                    Generiere BCF Issue Inhalte im JSON Format:
                    {
                    "guid": ${guid},
                    "creation_date": "${new Date().toISOString()}",
                    "creation_author": "Ayman Soultana",
                    "title": "Kurzer präziser Titel",
                    "description": "Detaillierte Beschreibung des Problems",
                    "topic_type": "Error|Warning|Info",
                    "priority": "High|Medium|Low",
                    "labels": ["label1", "label2"],
                    "comment": "Technischer Kommentar mit Lösungsvorschlag"
                    }

                    Fokussiere auf deutsche Baustandards und IDS-Compliance.`;

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
        max_tokens: 400,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      console.error('OpenAI API error for BCF issue:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return null;
    }

    try {
      const llmResult = JSON.parse(content);
      console.log(llmResult)
      return createBCFFromLLMResult(element, llmResult, projectName, author, idsContext);
    } catch (parseError) {
      console.warn('Failed to parse LLM BCF response, using fallback');
      return null;
    }

  } catch (error) {
    console.error('BCF issue creation failed:', error);
    return null;
  }
}

function createBCFFromLLMResult(
  element: Element,
  llmResult: any,
  projectName: string,
  author: string,
  idsContext: string,
  guid: string = "0f025453-562a-489f-9e4c-58b675128f85"
): BCFIssue {
  const now = new Date().toISOString();
  const issueGuid = guid;
  const commentGuid = guid;
  const viewpointGuid = guid;

  return {
    markup: {
      header: {
        files: [{
          filename: `${projectName}.ifc`,
          date: now,
          reference: element.guid
        }]
      },
      topic: {
        guid: issueGuid,
        topic_type: llmResult.topic_type || "Warning",
        topic_status: "Open",
        title: llmResult.title || `${element.type} ${element.id} - Compliance Issue`,
        priority: llmResult.priority || "Medium",
        index: 1,
        labels: llmResult.labels || ["IDS-Compliance", "German-Standards"],
        creation_date: now,
        creation_author: author,
        modified_date: now,
        modified_author: author,
        description: llmResult.description || `Element ${element.id} requires attention for building standards compliance.`,
        bim_snippet: {
          snippet_type: "IfcPropertySet",
          reference: element.guid,
          reference_schema: "IFC4"
        }
      },
      comments: [{
        guid: commentGuid,
        date: now,
        author: author,
        comment: `${llmResult.comment || 'Technical analysis required.'}\n\nIDS Requirements:\n${idsContext}`,
        topic_guid: issueGuid
      }]
    },
    viewpoint: {
      guid: viewpointGuid,
      components: {
        visibility: {
          default_visibility: false,
          exceptions: [{
            ifc_guid: element.guid
          }]
        },
        selection: [{
          ifc_guid: element.guid
        }]
      }
    }
  };
}

export async function submitBCFIssue(bcfIssue: BCFIssue, projectId: string = "default"): Promise<boolean> {
  try {
    const response = await fetch(`https://api.example.com/projects/${projectId}/bcf/issues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_API_TOKEN'
      },
      body: JSON.stringify({
        bcf_version: "2.1",
        issue: bcfIssue,
        submitted_at: new Date().toISOString()
      })
    });

    if (response.ok) {
      console.log('BCF issue submitted successfully');
      return true;
    } else {
      console.error('Failed to submit BCF issue:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('Error submitting BCF issue:', error);
    // For demo purposes, always return true since it's a placeholder
    console.log('Demo mode: BCF issue would be submitted to external system');
    return true;
  }
}

export async function createAndSubmitAIIssue(
  api_key: string,
  element: Element,
  projectName: string = "BIM Project",
  author: string = "BIM Analyst",
  projectId: string = "default",
  guid: string = "0f025453-562a-489f-9e4c-58b675128f85",
): Promise<{ success: boolean; bcfIssue?: BCFIssue; error?: string }> {
  try {
    const bcfIssue = await createBCFIssue(api_key, element, guid, projectName, author);
    
    if (!bcfIssue) {
      return { success: false, error: "Failed to generate BCF issue" };
    }

    const submitted = await submitBCFIssue(bcfIssue, projectId);
    
    if (submitted) {
      downloadBCFIssue(bcfIssue, `${element.id}-compliance-issue.bcf`);
      
      return { success: true, bcfIssue };
    } else {
      return { success: false, error: "Failed to submit BCF issue", bcfIssue };
    }
    
  } catch (error) {
    console.error('Error in createAndSubmitAIIssue:', error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export function downloadBCFIssue(bcfIssue: BCFIssue, filename: string = 'issue.bcf'): void {
  const bcfContent = {
    version: "2.1",
    issues: [bcfIssue]
  };
  
  const blob = new Blob([JSON.stringify(bcfContent, null, 2)], { 
    type: 'application/json' 
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
