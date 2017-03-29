<?php

/**
 *
 * Each database table's DAO file extends this class in order to gain access to common DB functionality.
 *
 */
abstract class Bip_DAO_Abstract { // implements Bip_Model_InvokerInterface {

    protected $_dbName = NULL;
    
    protected $_options;
    
    /* Search map key */
    const CACHEKEY_SMAP = 'smap';

    /* Obj UUID */
    const CACHEKEY_UUID = 'objuuid';

    /* Obj relational map */
    const CACHEKEY_RMAP = 'rmap';

    /* Overrides the cache key version for this DAO */
    const CACHE_VERSION = NULL;

    /* @var Zend_Log */
    private $_logger;

    /* @var bool Indicates whether or not the client is interested in using caching features of
     * the dao layer. Note that in order to have caching actually take place, the caching object
     * must be properly configured or else no caching will occur.
     */
    private $_useCache = false;

    /* @var Bip_Utility_Cache */
    protected $_cacheObject;    

    protected $_nameSpace = 'Bip';

    /* Model/Table name (model and table should match) */
    protected $_name = NULL;

    /* Name used for context switching */
    protected $_nameOrig = NULL;

    // Include 'deleted' results in result.
    const OPT_INCDELETED = 0;

    // Skip caching
    const OPT_NOCACHE = 1;

    // When running a search return the ID graph only
    const OPT_MAPONLY = 4;

    const OPT_REFRESH = 5;

    const OPT_GETSELECT = 6;

    public function setNameSpace($nameSpace) {
        $this->_nameSpace = $nameSpace;
    }

    public function getNameSpace() {
        return $this->_nameSpace;
    }

    public function getDomainModelName($modelName = NULL) {
        return $this->_nameSpace.'_Model_' . ($modelName === NULL ? $this->_name : $modelName);

    }

    /**
     * Returns a new instance of Model_Abstract domain model in child context
     * @return Model_Abstract
     */
    public function getDomainModel($modelName = NULL) {
        $className = $this->getDomainModelName($modelName);
        return new $className;

    }

    public function getMapperObjectName($tableName = NULL) {
        return $this->_nameSpace.'_Model_' . ($tableName === NULL ? $this->_name : $tableName);
    }

    /**
     * Returns a new instance of Database_Table_Abstract in child context
     * @return Bip_Databas
     */
    public function getMapperObject($tableName = NULL) {
        $tableClass = $this->getMapperObjectName($tableName);
        return new $tableClass;
    }

    /**
     * Model helper, maps a Bip row into a new instance of this domain model
     * @param Bip_ZendFrameworkTweak_Db_Table_Row $row
     * @return Model_Abstract child instance
     */
    public function mapRowToDomainModel(Bip_ZendFrameworkTweak_Db_Table_Row $row) {
        $domainModel = $this->getDomainModel();
        $domainModel->fromRow($row);

        $this->mapRowToDomainModelAuditFields($domainModel, $row);

        $domainModel->setInvoker($this);

        return $domainModel;

    }

    /**
     * Given a domain model, returns a populated row object.
     * @param FgRestAPI_Model_Abstract
     * @return Bip_ZendFrameworkTweak_Db_Table_Row
     */
    public function mapDomainModelToRow(Bip_Model_Abstract $domainModel) {

        /* @var Bip_Database_RestAPI_Table_Transaction */
        $row = $this->createDbRow();

        $realRow = $domainModel->toRow($row);

        // Sets the deleted, date_created and date_updated values.
        $this->mapDomainModelToRowAuditFields($realRow, $domainModel);

        return $realRow;

    }

    /**
     * Toggles whether or not the data access layer will use caching.
     * @param bool $enabled
     */
    public function setUseCacheIfPossible($enabled) {
        $this->_useCache = $enabled;

    }

    /**
     * Returns whether or not cache is currently being attempted.
     * @return bool
     */
    public function getUseCacheIfPossible() {
        return $this->_useCache;

    }

    public function __construct(array $args = array()) {
        $fc = Zend_Controller_Front::getInstance();;
        $this->_options = Zend_Registry::get('config')->toArray();
        $this->_db = $fc->getParam('bootstrap')->getResource('mongo');
    }

    protected function createDbRow($tableName = NULL) {
        $tableObject = $this->getMapperObject($tableName);
        $row = $tableObject->createRow();
        return $row;
    }

    /**
     * @param Bip_Model_Abstract $domainModel
     * @return int Table key.
     */
    public function create(Bip_Model_Abstract $domainModel, $modelName = NULL) {

        $contextSwitch = !is_null($modelName);
        if ($contextSwitch) {
            $this->newContext($modelName);
        } else {            
            $dmSuffix = $domainModel->getName(TRUE);
            if ($dmSuffix != $this->_name) {
                $contextSwitch = $dmSuffix;
                $this->newContext($dmSuffix);
            }
        }

        /* @var Bip_ZendFrameworkTweak_Db_Table_Row */
        $row = $this->mapDomainModelToRow($domainModel);

        // Optionally customize rows.
        $this->setCustomNewRowValues($row);

        // Save the record.
        if ($domainModel->isUUIDType()) {

            $newId = Bip_Utility_String_General::timeUUID();
            $row[$domainModel->getIdField()] = $newId;
            $row->save();

        } else {
            $newId = $row->save();
        }

        // Refresh the model from the saved row.
        $domainModel->fromRow($row);

        $this->mapRowToDomainModelAuditFields($domainModel, $row);

        // Set the new id.
        $domainModel->setId($newId);

        $domainModel->setInvoker($this);

        // Save the domain model to Memcache
        $this->saveDomainModelToCache($newId, $domainModel);

        // If the working model has been configured to automatically summarise
        // then create an empty summary in our data source
        if ($domainModel->autoSummarise()) {            
            
            $summaryClass = $this->getDomainModelName().'Summary';

            $sModel = new $summaryClass();

            // initialise...
            $sModel[$domainModel->getIdField()] = $domainModel->getId();

            // create
            $this->create($sModel);
        }

        if ($contextSwitch) {
            $this->endContext();
        }

        return $domainModel->getId();
    }

    
    /**
     *
     * @param array $query
     * @param <type> $options
     * @param <type> $mapTimeout
     * @return <type>
     */
    public function search(
                            $modelName,
                            $query = array(),
                            $options = array(),
                            $mapTimeout = FALSE) {

        $this->newContext($modelName);
        
        // Setup some helpers for our DB driven translation logic
        $modelObject = $this->getDomainModel();

        $collection = new MongoCollection($this->_db, $modelObject->getCollectionName());

        $cursor = $collection->find($query);

        $results = array();
        foreach ($cursor as $result) {
            $results[] = $result;
        }

        return $results;
    }
    /**
     * Changes the 'name' context for the DAO - use at your own risk!
     * @param string $newContext new model name
     */
    public function newContext($newContext) {
        if (is_null($this->_nameOrig)) {
            $this->_nameOrig = $this->_name;
        }
        $this->_name = $newContext;

        $mo = $this->getMapperObject($this->_name);
        return $this;
    }

    /**
     * Resets the 'name' context for the DAO to its original state.
     */
    public function endContext() {
        if (!is_null($this->_nameOrig)) {
            $this->_name = $this->_nameOrig;
        }
        return $this;
    }

    public function getContext() {
        return $this->_name;
    }

}