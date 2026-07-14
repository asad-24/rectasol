import { faqs } from "@/data/site";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SectionHeader } from "./SectionHeader";

export function FaqSection() {
  return (
    <section className="section-pad bg-white">
      <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeader
          align="left"
          eyebrow="FAQ"
          title="Questions before the first call"
          description="Short answers for the first version of RectaSol. The real detail comes after the project context is clear."
        />
        <Accordion type="single" collapsible className="rounded-lg border border-recta-ink/10 bg-background px-6">
          {faqs.map((faq, index) => (
            <AccordionItem key={faq.question} value={`item-${index}`}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
