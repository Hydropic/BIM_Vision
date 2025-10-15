export type Status = 'todo' | 'in-progress' | 'done'
export type Priority = 'low' | 'medium' | 'high'

export type Task = {
  version: string;
  status: Status;
  issues: {
    markup: {
      header: {
        files: {
          filename: string;
          date: string;
          reference: string;
        }[];
      };
      topic: {
        guid: string;
        topic_type: string;
        topic_status: string;
        title: string;
        priority: string;
        index: number;
        labels: string
        creation_date: string;
        creation_author: string;
        modified_date: string;
        modified_author: string;
        description: string;
        bim_snippet: {
          snippet_type: string;
          reference: string;
          reference_schema: string;
        };
      };
      comments: {
        guid: string;
        date: string;
        author: string;
        comment: string;
        topic_guid: string;
      }[];
    };
    viewpoint: {
      guid: string;
      components: {
        visibility: {
          default_visibility: boolean;
          exceptions: {
            ifc_guid: string;
          }[];
        };
        selection: {
          ifc_guid: string;
        }[];
      };
    };
  }[];
};


export const statuses: Status[] = ['todo', 'in-progress', 'done']
export const priorities: Priority[] = ['low', 'medium', 'high']
