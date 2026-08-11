import * as React from 'react';
import {
  Alert,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import ReusableDataTable from '../components/ReusableData';
import PageContainer from '../components/PageContainer';
import DynamicModal from '../components/DynamicModel';

const INITIAL_PAGE_SIZE = 10;
const PERM_KEY = 'manualSurvey';

const mapSurveyRow = (row) => ({
  ...row,
  title: row.title || row.dealer_code_temp || '',
  location_name: row.location_name || row.region || '',
  instructions: row.instructions || '',
});

export default function ManualSurvey() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { user } = useAuth();
  const { get, post, put, del } = useApi();

  const canRead = user?.permissions?.[PERM_KEY]?.includes('read') || false;
  const canCreate = user?.permissions?.[PERM_KEY]?.includes('create') || false;
  const canUpdate = user?.permissions?.[PERM_KEY]?.includes('update') || false;
  const canDelete = user?.permissions?.[PERM_KEY]?.includes('delete') || false;

  const [rowsState, setRowsState] = React.useState({
    rows: [],
    rowCount: 0,
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState('view');
  const [selectedSurvey, setSelectedSurvey] = React.useState(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [surveyToDelete, setSurveyToDelete] = React.useState(null);

  const [paginationModel, setPaginationModel] = React.useState({
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 0,
    pageSize: searchParams.get('pageSize')
      ? Number(searchParams.get('pageSize'))
      : INITIAL_PAGE_SIZE,
  });

  const [filterModel, setFilterModel] = React.useState(
    searchParams.get('filter')
      ? JSON.parse(searchParams.get('filter') ?? '')
      : { items: [] },
  );

  const [sortModel, setSortModel] = React.useState(
    searchParams.get('sort') ? JSON.parse(searchParams.get('sort') ?? '') : [],
  );

  const validateTitle = (title) => {
    if (!title || String(title).trim() === '') return 'Title is required';
    return '';
  };

  const validateLocationName = (locationName) => {
    if (!locationName || String(locationName).trim() === '') return 'Location name is required';
    return '';
  };

  const validateInstructions = (instructions) => {
    if (!instructions || String(instructions).trim() === '') return 'Instructions are required';
    return '';
  };

  React.useEffect(() => {
    if (!canRead) {
      setError('You do not have permission to view this page');
      toast.error('You do not have permission to view this page', {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }, [canRead]);

  const surveyFields = [
    {
      name: 'title',
      label: 'Title',
      type: 'text',
      required: true,
      validate: validateTitle,
    },
    {
      name: 'location_name',
      label: 'Location Name',
      type: 'text',
      required: true,
      validate: validateLocationName,
    },
    {
      name: 'instructions',
      label: 'Instructions',
      type: 'text',
      multiline: true,
      rows: 4,
      required: true,
      validate: validateInstructions,
    },
  ];

  const handlePaginationModelChange = React.useCallback(
    (model) => {
      setPaginationModel(model);
      searchParams.set('page', String(model.page));
      searchParams.set('pageSize', String(model.pageSize));
      const newSearchParamsString = searchParams.toString();
      navigate(
        `${pathname}${newSearchParamsString ? '?' : ''}${newSearchParamsString}`,
      );
    },
    [navigate, pathname, searchParams],
  );

  const handleFilterModelChange = React.useCallback(
    (model) => {
      setFilterModel(model);
      if (
        model.items.length > 0 ||
        (model.quickFilterValues && model.quickFilterValues.length > 0)
      ) {
        searchParams.set('filter', JSON.stringify(model));
      } else {
        searchParams.delete('filter');
      }
      const newSearchParamsString = searchParams.toString();
      navigate(
        `${pathname}${newSearchParamsString ? '?' : ''}${newSearchParamsString}`,
      );
    },
    [navigate, pathname, searchParams],
  );

  const handleSortModelChange = React.useCallback(
    (model) => {
      setSortModel(model);
      if (model.length > 0) {
        searchParams.set('sort', JSON.stringify(model));
      } else {
        searchParams.delete('sort');
      }
      const newSearchParamsString = searchParams.toString();
      navigate(
        `${pathname}${newSearchParamsString ? '?' : ''}${newSearchParamsString}`,
      );
    },
    [navigate, pathname, searchParams],
  );

  const handleView = React.useCallback((row) => {
    if (!canRead) return;
    setSelectedSurvey(row);
    setModalMode('view');
    setModalOpen(true);
  }, [canRead]);

  const handleEdit = React.useCallback((row) => {
    if (!canUpdate) return;
    setSelectedSurvey(row);
    setModalMode('edit');
    setModalOpen(true);
  }, [canUpdate]);

  const handleDelete = React.useCallback(
    (row) => {
      if (!canDelete) return;
      setSurveyToDelete(row);
      setDeleteDialogOpen(true);
    },
    [canDelete],
  );

  const loadSurveys = React.useCallback(async () => {
    if (!canRead) return;

    setError(null);
    setIsLoading(true);

    try {
      const { page, pageSize } = paginationModel;
      const apiUrl = `/api/shopboard-requests?is_manual_survey=true&page=${page}&size=${pageSize}`;
      const response = await get(apiUrl);

      let rows = [];
      let totalCount = 0;
      if (response?.success && Array.isArray(response.data)) {
        rows = response.data.map(mapSurveyRow);
        totalCount = response.totalCount || rows.length;
      } else if (Array.isArray(response)) {
        rows = response.map(mapSurveyRow);
        totalCount = rows.length;
      }

      setRowsState({ rows, rowCount: totalCount });
    } catch (loadError) {
      setError(loadError.message || 'Failed to load manual surveys');
      toast.error('Failed to load manual surveys', {
        position: 'top-right',
        autoClose: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [canRead, get, paginationModel]);

  React.useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  const confirmDelete = React.useCallback(async () => {
    if (!surveyToDelete) return;
    setIsLoading(true);
    try {
      const response = await del(`/api/shopboard-requests/${surveyToDelete.id}`);
      if (response?.success === false) {
        throw new Error(response.message || 'Failed to delete survey');
      }
      toast.success('Survey deleted successfully', {
        position: 'top-right',
        autoClose: 3000,
      });
      setDeleteDialogOpen(false);
      setSurveyToDelete(null);
      await loadSurveys();
    } catch (deleteError) {
      toast.error(deleteError.message || 'Failed to delete survey', {
        position: 'top-right',
        autoClose: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [surveyToDelete, del, loadSurveys]);

  const cancelDelete = React.useCallback(() => {
    setDeleteDialogOpen(false);
    setSurveyToDelete(null);
  }, []);

  const handleCreate = React.useCallback(() => {
    if (!canCreate) return;
    setSelectedSurvey({});
    setModalMode('create');
    setModalOpen(true);
  }, [canCreate]);

  const handleRefresh = React.useCallback(() => {
    if (!isLoading && canRead) {
      loadSurveys();
    }
  }, [isLoading, canRead, loadSurveys]);

  const handleRowClick = React.useCallback(
    ({ row }) => {
      handleView(row);
    },
    [handleView],
  );

  const handleModalSubmit = async (formData) => {
    const titleError = validateTitle(formData.title);
    const locationError = validateLocationName(formData.location_name);
    const instructionsError = validateInstructions(formData.instructions);

    if (titleError || locationError || instructionsError) {
      toast.error(titleError || locationError || instructionsError, {
        position: 'top-right',
        autoClose: 5000,
      });
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        is_manual_survey: true,
        title: String(formData.title).trim(),
        location_name: String(formData.location_name).trim(),
        instructions: String(formData.instructions).trim(),
      };

      const response =
        modalMode === 'edit' && selectedSurvey?.id
          ? await put(`/api/shopboard-requests/${selectedSurvey.id}`, payload)
          : await post('/api/shopboard-requests', payload);

      if (response?.success === false) {
        throw new Error(response.message || 'Failed to save survey');
      }

      toast.success(
        modalMode === 'edit' ? 'Survey updated successfully' : 'Survey created successfully',
        { position: 'top-right', autoClose: 3000 },
      );
      setModalOpen(false);
      await loadSurveys();
    } catch (saveError) {
      toast.error(saveError.message || 'Failed to save survey', {
        position: 'top-right',
        autoClose: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const columns = React.useMemo(
    () => [
      {
        field: 'id',
        headerName: 'ID',
        width: 70,
      },
      {
        field: 'title',
        headerName: 'Title',
        width: 220,
      },
      {
        field: 'location_name',
        headerName: 'Location Name',
        width: 220,
      },
      {
        field: 'instructions',
        headerName: 'Instructions',
        flex: 1,
        minWidth: 250,
      },
    ],
    [],
  );

  const pageTitle = 'Manual Survey';

  if (!canRead) {
    return (
      <PageContainer title={pageTitle} breadcrumbs={[{ title: pageTitle }]}>
        <Alert severity="error" sx={{ mb: 2 }}>
          You do not have permission to view this page
        </Alert>

        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
          toastStyle={{
            backgroundColor: '#ffffff',
            color: '#333333',
          }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={pageTitle}
      breadcrumbs={[{ title: pageTitle }]}
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <ReusableDataTable
        data={rowsState.rows}
        columns={columns}
        loading={isLoading}
        error={error}
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationModelChange}
        rowCount={rowsState.rowCount}
        paginationMode="server"
        sortModel={sortModel}
        onSortModelChange={handleSortModelChange}
        sortingMode="client"
        filterModel={filterModel}
        onFilterModelChange={handleFilterModelChange}
        filterMode="client"
        onView={canRead ? handleView : null}
        onEdit={canUpdate ? handleEdit : null}
        onDelete={canDelete ? handleDelete : null}
        onCreate={canCreate ? handleCreate : null}
        onRefresh={canRead ? handleRefresh : null}
        onRowClick={canRead ? handleRowClick : null}
        pageSizeOptions={[5, 10, 25, 50]}
        showToolbar={true}
      />

      <DynamicModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode={modalMode}
        title={`${modalMode === 'create' ? 'Create' : modalMode === 'edit' ? 'Edit' : 'View'} Manual Survey`}
        initialData={selectedSurvey || {}}
        fields={surveyFields}
        onSubmit={handleModalSubmit}
        loading={isLoading}
      />

      <Dialog
        open={deleteDialogOpen}
        onClose={cancelDelete}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '400px',
          }
        }}
      >
        <DialogTitle
          id="delete-dialog-title"
          sx={{
            color: '#d32f2f',
            fontWeight: 'bold',
          }}
        >
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#333', mb: 2 }}>
            Are you sure you want to delete the survey <strong>"{surveyToDelete?.title}"</strong>?
          </Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={cancelDelete}
            variant="outlined"
            sx={{
              color: '#666',
              borderColor: '#ddd',
              '&:hover': {
                borderColor: '#999',
                backgroundColor: '#f5f5f5',
              }
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            variant="contained"
            sx={{
              backgroundColor: '#d32f2f',
              color: '#ffffff',
              '&:hover': {
                backgroundColor: '#c62828',
              },
              '&:disabled': {
                backgroundColor: '#ffcdd2',
                color: '#ffffff',
              }
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        toastStyle={{
          backgroundColor: '#ffffff',
          color: '#333333',
        }}
      />
    </PageContainer>
  );
}
