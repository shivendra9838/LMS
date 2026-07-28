import { Search, Filter } from 'lucide-react';

const SearchBar = ({ searchInput, setSearchInput, handleSearch, showFilters, setShowFilters }) => {
  return (
    <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
      <form onSubmit={handleSearch} className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input 
          type="text" 
          placeholder="Search by name, code, mobile..." 
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="input-field pl-10 w-full"
        />
      </form>
      {setShowFilters && (
        <button 
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
