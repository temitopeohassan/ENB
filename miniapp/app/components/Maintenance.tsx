// app/components/Maintenance.tsx or wherever your file is

import Image from 'next/image';
import maintenanceImage from './maintenancemode.png'; // adjust the path if needed

export function Maintenance() {
  return (
    <div className="text-center p-8">
      <h1 className="text-2xl font-bold mb-4">Maintenance Mode</h1>
      <Image
        src={maintenanceImage}
        alt="Maintenance Mode"
        width={400} // adjust width as needed
        height={400} // adjust height as needed
      />
    </div>
  );
}
