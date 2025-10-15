export interface ElementProps {
  UValue?: number | null;
  fireClass?: string | null;
  material?: string;
}

export interface Element {
  id: string;
  type: string;
  props: ElementProps;
  status: 'pass' | 'warn' | 'fail' | 'unknown';
  color: number;
  guid: string;
}

export interface Issue {
  id: string;
  elementId: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface AIRecommendation {
  analysis: string;
  suggestions: Array<{
    property: string;
    label: string;
    options: Array<{
      value: string | number;
      reason: string;
    }>;
  }>;
}
