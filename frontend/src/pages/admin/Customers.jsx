import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';

import CustomerTable from '../../components/CustomerTable';
import Pagination from '../../components/Pagination';
import SearchBar from '../../components/SearchBar';
import FilterBar from '../../components/FilterBar';

const Customers = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    city: '',
    area: '',
    employee: ''
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      let query = `/customers?page=${page}&limit=10`;
      if (search) query += `&search=${search}`;
      if (filters.status) query += `&status=${filters.status}`;
      if (filters.city) query += `&city=${filters.city}`;
      if (filters.area) query += `&area=${filters.area}`;
      if (filters.employee) query += `&employee=${filters.employee}`;

      const res = await api.get(query);
      setCustomers(res.data.data);
      setTotalPages(res.data.meta.totalPages);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, search, filters]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">All Customers</h1>
          <p className="text-sm text-gray-500 mt-1">Enterprise-wide customer oversight and auditing</p>
        </div>
      </div>

      <div className="glass-panel">
        <SearchBar 
          searchInput={searchInput} 
          setSearchInput={setSearchInput} 
          handleSearch={handleSearch} 
          showFilters={showFilters} 
          setShowFilters={setShowFilters} 
        />
        
        {showFilters && (
          <FilterBar 
            filters={filters} 
            handleFilterChange={handleFilterChange} 
            isAdmin={true} 
          />
        )}

        <div className="overflow-x-auto min-h-[400px]">
          <CustomerTable 
            customers={customers} 
            loading={loading} 
            refresh={fetchCustomers}
            basePath="/admin/customers"
          />
        </div>
        
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50/30">
            <Pagination 
              currentPage={page} 
              totalPages={totalPages} 
              onPageChange={setPage} 
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Customers;
