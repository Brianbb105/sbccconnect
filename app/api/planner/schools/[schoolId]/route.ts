import { getAssistPlannerCatalog, getAssistPlannerSchoolMajors } from "@/lib/assistPlanner";

// Emit the JSON during the build, so production needs no access to the source archive.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
    return getAssistPlannerCatalog().schools.map((school) => ({ schoolId: school.id }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ schoolId: string }> }) {
    const { schoolId } = await params;
    const majors = getAssistPlannerSchoolMajors(schoolId);
    if (!majors) return Response.json({ error: "School not found." }, { status: 404 });
    return Response.json(majors);
}
