import { Search, Filter } from 'lucide-react';
import { useState } from 'react';

const SearchBar = ({ searchInput, setSearchInput, handleSearch, showFilters, setShowFilters, onSearch, placeholder = 'Search by name, code, mobile...' }) => {
  const [localSearch, setLocalSearch] = useState('');
  const submit = event => { event.preventDefault(); if (handleSearch) handleSearch(event); else onSearch?.(localSearch); };
  return (
    <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
      <form onSubmit={submit} role="search" className="flex w-full max-w-md gap-2">
        <div className="relative min-w-0 flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input 
          type="search"
          enterKeyHint="search"
          aria-label={placeholder}
          placeholder={placeholder}
          value={searchInput ?? localSearch}
          onChange={(e) => setSearchInput ? setSearchInput(e.target.value) : setLocalSearch(e.target.value)}
          className="input-field pl-10 w-full"
        />
        </div>
        <button type="submit" className="btn-secondary !px-3" aria-label="Search"><Search size={18} /></button>
      </form>
      {setShowFilters && (
        <button 
          type="button" aria-expanded={showFilters}
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary flex items-center gap-2 ${showFilters ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}`}
        >
          <Filter size={18} />
          Filters
        </button>
      )}
    </div>
  );
};

export default SearchBar;
