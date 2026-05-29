import { SaleLpgForm } from "@/components/SaleLpgForm";
import { SaleLpgList } from "@/components/SaleLpgList";

export default function SaleLpgPage() {
  return (
    <>
      <SaleLpgList />
      <div id="sale-lpg-form">
        <SaleLpgForm />
      </div>
    </>
  );
}
