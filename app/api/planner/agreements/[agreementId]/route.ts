import { getAssistPlannerAgreement, getAssistPlannerAgreementIds } from "@/lib/assistPlanner";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
    return getAssistPlannerAgreementIds().map((agreementId) => ({ agreementId }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ agreementId: string }> }) {
    const { agreementId } = await params;
    const agreement = getAssistPlannerAgreement(agreementId);
    if (!agreement) return Response.json({ error: "Agreement not found." }, { status: 404 });
    return Response.json(agreement);
}
