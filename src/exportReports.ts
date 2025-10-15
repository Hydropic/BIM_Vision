export interface ElementData {
    id: string;
    type: string;
    props: Record<string, any>;
    status: string;
}

export function createReport(elements: ElementData[]) {
    return {
        elements: elements.map(e => ({
            id: e.id,
            type: e.type,
            status: e.status,
            props: e.props
        }))
    };
}

export function logTest(elements:ElementData[]) {
    const report = createReport(elements);
    console.log("report: " + report)
}