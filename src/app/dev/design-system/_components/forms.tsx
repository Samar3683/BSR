import { Checkbox, Radio } from "@/components/forms/choice";
import { Field } from "@/components/forms/field";
import { Fieldset } from "@/components/forms/fieldset";
import { Select } from "@/components/forms/select";
import { TextArea, TextInput } from "@/components/forms/text-input";
import { Surface } from "@/components/layout/surface";
import { Button } from "@/components/ui/button";

import { PreviewSection } from "./preview-section";

function FormSamples({ idPrefix }: { idPrefix: string }) {
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="grid gap-x-8 gap-y-8 md:grid-cols-2">
      <Field id={id("default")} label="Default Field" hint="Hint example describing the format.">
        {(control) => <TextInput {...control} placeholder="Placeholder" />}
      </Field>
      <Field id={id("required")} label="Required Field" required>
        {(control) => <TextInput {...control} defaultValue="Filled value" />}
      </Field>
      <Field id={id("error")} label="Error State" error="Error message example explaining the fix.">
        {(control) => <TextInput {...control} defaultValue="Invalid value" />}
      </Field>
      <Field id={id("success")} label="Success State" success="Confirmation message example.">
        {(control) => <TextInput {...control} defaultValue="Valid value" />}
      </Field>
      <Field id={id("disabled")} label="Disabled Field">
        {(control) => <TextInput {...control} disabled defaultValue="Unavailable value" />}
      </Field>
      <Field id={id("readonly")} label="Read-only Field">
        {(control) => <TextInput {...control} readOnly defaultValue="Fixed value" />}
      </Field>
      <Field id={id("select")} label="Select Field">
        {(control) => (
          <Select {...control} defaultValue="">
            <option value="" disabled>
              Choose an option
            </option>
            <option value="a">Option A</option>
            <option value="b">Option B</option>
          </Select>
        )}
      </Field>
      <Field id={id("textarea")} label="Textarea Field" hint="Hint example.">
        {(control) => <TextArea {...control} placeholder="Placeholder" />}
      </Field>
      <Fieldset id={id("radios")} legend="Radio Group" hint="Choose one option.">
        <Radio name={id("radio")} value="a" label="Option A" defaultChecked />
        <Radio name={id("radio")} value="b" label="Option B" />
        <Radio name={id("radio")} value="c" label="Unavailable Option" disabled />
      </Fieldset>
      <Fieldset
        id={id("checks")}
        legend="Checkbox Group"
        error="Error message example for a group."
      >
        <Checkbox name={id("check")} value="a" label="Option A" defaultChecked />
        <Checkbox name={id("check")} value="b" label="Option B" aria-invalid />
        <Checkbox name={id("check")} value="c" label="Unavailable Option" disabled />
      </Fieldset>
    </div>
  );
}

export function FormsPreview() {
  return (
    <PreviewSection
      id="forms"
      title="Form foundations"
      description="Labels always above controls, hints before the control, messages with icon + text. Task mode: no decoration, no motion beyond state feedback."
    >
      <FormSamples idPrefix="dark" />
      <Surface tone="soft-white" className="rounded-lg p-6 sm:p-10">
        <div className="flex flex-col gap-8">
          <FormSamples idPrefix="light" />
          <div className="flex flex-wrap gap-3">
            <Button>Primary Action</Button>
            <Button variant="ghost">Secondary Action</Button>
          </div>
        </div>
      </Surface>
    </PreviewSection>
  );
}
