'use client';

interface BoosterCardProps {
  onBoosterClick: () => void;
}

export const BoosterCard: React.FC<BoosterCardProps> = ({ onBoosterClick }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md border">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Boosters</h2>
      <div className="space-y-3">
        <button
          onClick={onBoosterClick}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
        >
          Boosters
        </button>
      </div>
    </div>
  );
};
