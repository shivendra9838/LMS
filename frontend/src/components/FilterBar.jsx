const FilterBar = ({ filters, handleFilterChange, isAdmin }) => {
  return (
    <div className="p-4 bg-white border-b border-gray-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2">
      <div>
        <label htmlFor="field-status" className="block text-xs font-medium text-gray-500 mb-1">Status</label>
        <select id="field-status" name="status" value={filters.status} onChange={handleFilterChange} className="input-field py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>
      <div>
        <label htmlFor="field-city" className="block text-xs font-medium text-gray-500 mb-1">City</label>
        <input id="field-city" type="text" name="city" value={filters.city} onChange={handleFilterChange} placeholder="Filter by city..." className="input-field py-2 text-sm" />
      </div>
      <div>
        <label htmlFor="field-area" className="block text-xs font-medium text-gray-500 mb-1">Area</label>
        <input id="field-area" type="text" name="area" value={filters.area} onChange={handleFilterChange} placeholder="Filter by area..." className="input-field py-2 text-sm" />
      </div>
      {isAdmin && (
        <div>
          <label htmlFor="field-employee-code" className="block text-xs font-medium text-gray-500 mb-1">Employee Code</label>
          <input id="field-employee-code" type="text" name="employee" value={filters.employee} onChange={handleFilterChange} placeholder="e.g. EMP0001" className="input-field py-2 text-sm" />
        </div>
      )}
    </div>
  );
};

export default FilterBar;
