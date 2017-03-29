<?php
/**
 *
 * Allows a domain model to act as an object, array and iterator.
 *
 * We do not want to save relations or invokers to our caches, which is why the
 * Serializable interface has been implemented.
 *
 * Date and Delete fields are privatised and are immutable to the model.
 *
 * Column names should be placed in child protected $_columns;
 *
 */
abstract class Bip_Model_Abstract implements ArrayAccess, Iterator, Serializable {

    protected $_invoker = NULL;
    protected $_idField = NULL;
    protected $_collection = NULL;

    /* @var bool $_uuidType model should generate uuid pkeys. */
    protected $_uuidType = TRUE;

    /* @var array $_columns an associative array of our columns */
    protected $_columns = array();

    /* @var array $_dependants an associative array of our dependant models (model class suffix => local column name */
    protected $_dependants = array();

    /* @todo audit column isolation */
    protected $_auditColumns = array(
        'date_created_timestamp' => NULL,
        'date_updated_timestamp' => NULL,
        'deleted' => NULL,
    );
    /**
     * Dynamically generated relations
     */
    protected $_rel = array();

    /* @var array $_validators associative array of validators, keyed to column */
    protected $_validators = array();

    /* @var array $_tainted temporal array of tainted bind columns */
    protected $_tainted = array();

    /* @var array $_cryptoFields associative array of encryptable fields, name keyed to encryption type. */
    protected $_cryptoFields = array();

    /* @var array $_currencyFields fields which can translate to currency formats (via this->_currency->$columnName helpers */
    protected $_currencyFields = array();
    /**
     * Enables explicit hashing against configured encrypted fields
     * @var bool $_autoHash auto hashing enabled
     */
    protected $_autoHash = FALSE;

    /**
     * @var bool $_autoSummary On create of this model, also create an empty Summary model
     */
    protected $_autoSummary = FALSE;
    /**
     * normative hash implies search term normalisation, ie: we convert the field
     * to lower case, trim spaces etc.  It should be used in conjunction with autohash.
     * @var bool $_normativeHash search term normalisation enabled.
     */
    protected $_normativeHash = FALSE;
    /**
     * Underlying model has a language datasource.
     * @var bool $_translatable Model name has a {Model}Language source
     */
    protected $_translatable = FALSE;
    /**
     * Automatically find columns with this suffix for hashing strategy
     * @var string $_hashSuffix column name suffix for auto hashing
     */
    private $_hashSuffix = '_hash';
    /**
     * @var mixed $_cacheExpiryOverride Override the TTL on a cache save (false to disable, or int seconds)
     */
    protected $_cacheExpiryOverride = FALSE;

    /**
     * By default models will be cached remotely
     */
    const CACHE_LOCATION = Bip_Utility_Cache::REMOTE_CACHE;

    /**
     * Child classes need to implement their own init functions (for validators, callbacks etc)
     * @param array $args optional construction arguments (forwarded by constructor)
     */
    abstract public function init(array $args = array());

    public function setInvoker(Bip_Model_InvokerInterface $invoker) {
        $this->_invoker = $invoker;
    }

    public function getCacheExpiry() {
        return $this->_cacheExpiryOverride;
    }

    public function getInvoker() {
        return $this->_invoker;
    }

    public function isUUIDType() {
        return $this->_uuidType;
    }

    /**
     * Model constructor, figures out our cryptographic fields and calls the
     * child init function.
     *
     * IMPORTANT: Like _cryptoFields, any new members that you introduce
     * need to be exposed to the serialiser.  Constructors are not called during
     * cache retrieval.
     *
     * @param array $args optional arguments
     */
    public function __construct(array $args = array()) {

        // if we have autohash enabled, an empty HASHING_STORAGE strategy
        // and an initialised encryption strategy in cryptofields, then try
        // to automatically hash any encrypted fields with complimentary _hash
        // columns in the table.
        if ($this->_autoHash &&
                !empty($this->_cryptoFields) &&
                empty($this->_cryptoFields[Bip_Service_Cryptography::HASHING_STORAGE])) {

            $hashStrategyFields = array();

            foreach ($this->_cryptoFields as $strategy => $strategyColumns) {
                foreach ($strategyColumns as $sColumn) {
                    // if we have a {$column}_hash field, then add it to hash strategy
                    $hashField = $sColumn . $this->_hashSuffix;
                    if (array_key_exists($hashField, $this->_columns)) {
                        $hashStrategyFields[] = $hashField;
                    }
                }
            }

            if (count($hashStrategyFields)) {
                $this->_cryptoFields[Bip_Service_Cryptography::HASHING_STORAGE] = array_unique($hashStrategyFields);
            }
        }

        // Setup Dependants

        $this->init($args);

    }

    /**
     * String representation of object
     * @return string serialized version of models columns
     */
    public function serialize() {
        $struct = array(
                        'columns' => $this->_columns,
                        'cryptoFields' => $this->_cryptoFields
                        );

        return serialize($struct);
    }


    /**
     * Constructs this object from a serialized source
     * @param string $serialized serialized version of this model
     */
    public function unserialize($serialized) {
        $struct = unserialize($serialized);

        $this->_columns = $struct['columns'];
        reset($this->_columns);

        if (is_array($struct['cryptoFields'])) {
            $this->_cryptoFields = $struct['cryptoFields'];
        }        
    }

    /**
     * This model has a language source
     * @return bool model has a language source
     */
    public function isTranslatable() {
        return $this->_translatable;
    }

    public function autoSummarise() {
        return $this->_autoSummary;
    }

    /**
     * Gets a language version of model name
     * @param string $context
     * @return <type>
     */
    static public function getLanguageName($context) {
        return str_replace(' ', '', ucwords(str_replace('_', ' ', $context))) . 'Language';

    }

    /**
     * Sets up a validation chain for the given column (can be called multiple times)
     * @param string $column Our model column name
     * @param Zend_Validate_Abstract $validator Validator we're adding to the chain
     */
    public function addValidator($column, Zend_Validate_Abstract $validator) {
        if (!array_key_exists($column, $this->_columns)) {
            throw new RuntimeException("Column $column does not exist");
        }

        if (!array_key_exists($column, $this->_validators)) {
            $this->_validators[$column] = new Zend_Validate();
        }

        $this->_validators[$column]->addValidator($validator);

        // Return a referecne to the chain
        return $this->_validators[$column];

    }

    /**
     * Gets the validator chain for a specific field
     * @param string $columnName our column name
     * @return Zend_Validate configured validator chain instance for the field
     */
    public function getValidator($columnName) {
        if (array_key_exists($columnName, $this->_validators)) {
            return $this->_validators[$columnName];
        }
        return NULL;

    }

    /**
     * Validates and binds a single column value (can be bypassed via magic setter)
     * @param string $columnName column name to bind
     * @param mixed $value new column value
     */
    public function bindColumn($columnName, $value) {
        // Skip binding to columns which aren't in the model.
        if (!array_key_exists($columnName, $this->_columns))
            return TRUE;

        $ok = TRUE;
        if (array_key_exists($columnName, $this->_validators)) {
            $ok = $this->_validators[$columnName]->isValid($value);
        }

        if ($ok) {
            //$this->_columns[$columnName] = $value;
            $this->__set($columnName, $value);
        }

        return $ok;

    }

    /**
     * Validates and binds form inputs against their configured validator chain
     * @param array $formData
     * @return bool data validated OK
     */
    public function bind(array $formData) {
        $this->_tainted = array();
        $ok = TRUE;
        foreach ($formData as $key => $value) {
            if (!$this->bindColumn($key, $value)) {
                $ok = FALSE;
                $this->_tainted[] = $key;
            }
        }
        return $ok;

    }

    /**
     * Returns a list of binding errors
     * @param string $columnName optional column name to retrieve the error for
     * @return array Associative array of error messages, keyed to column name
     */
    public function getErrors($columnName = NULL) {
        $eMsg = array();
        if ($columnName === NULL) {
            foreach ($this->_tainted as $columnName) {
                $eMsg[$columnName] = $this->_validators[$columnName]->getMessages();
            }
        } else {
            $eMsg[$columnName] = $this->_validators[$columnName]->getMessages();
        }

        return $eMsg;

    }

    public function getCollectionName($asModel = FALSE) {
        if (!$asModel) {
            return $this->_collection;
        } else {
            return str_replace(' ', '', ucwords(str_replace('_', ' ', $this->_collection)));
        }

    }

    public function addDependant($name, Bip_Model_Abstract $model) {
        if (!array_key_exists($name, $this->_rel)) {
            $this->_rel[$name] = array();
        }
        $this->_rel[$name] = $model;
    }

    /**
     * Clears dependants from this model
     * @param string $context optional dependant name
     * @return bool deps found and removed
     */
    public function clearDependants($context = NULL) {
        if (!empty($this->_dependants)) {
            if ($context !== NULL && array_key_exists($context, $this->_rel)) {
                unset($this->_rel[$context]);
            } else {
                foreach ($this->_rel as $key => $value) {
                    unset($this->_rel[$key]);
                }
                // do we rely on php's GC?
                $this->_rel = array();
            }
        }
        return FALSE;
    }

    /**
     * Lazy loads dependant models via DAO invoker
     * @param string $context new dao context
     * @param array $args optional extra search arguments
     * @return array list of loaded dependants
     */
    public function getDependants($context = NULL, $args = array()) {
        if (!empty($this->_dependants)) {

            // Load any dependants we do not already have
            if ($context == NULL) {
                foreach ($this->_dependants as $dContext => $localKey) {
                    $this->_loadDependant($dContext, $args);
                }
                return $this->_rel;
            } else {
                $this->_loadDependant($context, $args);
                return $this->_rel[$context];
            }
        }        

        return NULL;
    }

    /**
     * Registers a named query internal to this model.
     * @param string $alias query alias
     * @param string $context Model context
     * @param array $args search arguments
     * @return Bip_Database_NamedQuery
     */
    protected function _nqRegister($alias, $context = NULL, $args = array()) {

        // @todo This is too expensive
        $regKey = $alias.'_'.json_encode($args);

        $nq = Bip_Database_NamedQueryRegistry::get($regKey);

        if ($nq === NULL) {
            $nq = new Bip_Database_NamedQuery(
                        $context === NULL ? $this->_collection : $context,
                        $this->_invoker->getNameSpace(),
                        $args);
            Bip_Database_NamedQueryRegistry::set($regKey, $nq);
        }
        return $nq;
    }

    /**
     * Refreshes dependant objects for this model via named query
     * @param string $context Dependant model context (optional)
     * @param array $args arguments for dependants (optional)
     * @return mixed model or array
     */
    public function refreshDependants($context = NULL, $args = array()) {
        if (!empty($this->_dependants)) {

            // Load any dependants we do not already have
            if ($context == NULL) {
                foreach ($this->_dependants as $dContext => $localKey) {
                    $this->_refreshDependant($dContext, $args);
                }
                return $this->_rel;
            } else {
                $this->_refreshDependant($context, $args);
                return $this->_rel[$context];
            }
        }
        return NULL;
    }

    /**
     * Refreshes dependant graph in the cache in their appropriate context
     * @param string $context Dependant model context (optional)
     * @param array $args arguments for dependants (optional)
     */
    protected function _refreshDependant($context, $args = array()) {
        $asArray = (array_key_exists('_asArray', $args));
        if ($asArray) {
            unset($args['_asArray']);
        }

        $result = $this->_nqRegister('DEPENDANT_'.$context, $context, $args)->refresh();
        if ($asArray) {
            $model = $result;
        } else {
            if (count($result) == 1) {
                $model = array_pop($result);
            } else {
                $model = $result;
            }
        }

        $model = $result;

        if (empty($model)) {
            $model = FALSE;
        }

        $this->_rel[$context] = $model;
    }

    /**
     *
     * @param <type> $context
     * @param <type> $args 
     */
    protected function _loadDependant($context, $args = array()) {

        if (!array_key_exists($context, $this->_rel) || $this->_rel[$context] === NULL) {
        
            $localKey = $this->_dependants[$context];

            $args = array_merge(array($localKey => $this->_columns[$localKey]), $args);

            // If we always want an array returned...
            // @todo cleanup this API.
            $asArray = (array_key_exists('_asArray', $args));
            if ($asArray) {
                unset($args['_asArray']);
            }
            $noCache = (array_key_exists('_noCache', $args));
            if ($noCache) {
                unset($args['_noCache']);
            }

            // Execute from our named query
            $nq = $this->_nqRegister('DEPENDANT_'.$context, $context, $args);
            $result = ($noCache) ? $nq->noCache()->execute() : $nq->execute();

            if ($asArray) {
                $model = $result;                               
            } else {
                if (count($result) == 1) {                    
                    $model = array_pop($result);
                } else {
                    $model = $result;
                }
            }            

            if (empty($model)) {
                $model = FALSE;
            }

            $this->_rel[$context] = $model;
        }

    }

    public function hasDependants() {
        return!empty($this->_rel);

    }

    public function dropDependants($name = NULL) {
        if ($name === NULL) {
            $this->_rel = array();
        } else {
            unset($this->_rel[$name]);
        }

    }

    /**
     * Magic Setter for our model columns (prefix with 'set' is also fine)
     * @param string $name column name
     * @param mixed $value value of column (int or string)
     */
    public function __set($name, $value) {
        $name = preg_replace('/^set/i', '', $name);

        if (array_key_exists($name, $this->_columns)) {

            // Encrypt columns being set into the model
            $crypted = array($name => $value);
            $cryptCompleted = $this->_cryptColumns($crypted);
            $this->_columns[$name] = $crypted[$name];

            // if we have a {$name}_hash then create a hash as well.
            if ($this->_autoHash && $cryptCompleted) {
                $hashField = $name . $this->_hashSuffix;

                if (array_key_exists($hashField, $this->_columns)) {
                    if ($this->_normativeHash) {
                        $value = strtolower(preg_replace('/\s+/', ' ', $value));
                    }
                    $hashCol = array($hashField => $value);
                    $cryptCompleted = $this->_cryptColumns($hashCol);
                    $this->_columns[$hashField] = $hashCol[$hashField];

                }
            }
        } elseif (array_key_exists($name, $this->_auditColumns)) {
            $this->_auditColumns[$name] = $value;
        } else {
            // otherwise bail
            $trace = debug_backtrace();
            trigger_error(
                    'Undefined property via __get(): ' . $name .
                    ' in ' . $trace[0]['file'] .
                    ' on line ' . $trace[0]['line'],
                    E_USER_NOTICE);
        }

    }

    /**
     * Return the current element
     * @return mixed column offset
     */
    public function current() {
        return current($this->_columns);

    }

    /**
     * Return the key of the current element
     * @return scalar
     */
    public function key() {
        return key($this->_columns);

    }

    /**
     * Move forward to next element
     */
    public function next() {
        next($this->_columns);

    }

    /**
     * Rewind the Iterator to the first element
     */
    public function rewind() {
        reset($this->_columns);

    }

    /**
     * Checks if current position is valid
     * @return bool
     */
    public function valid() {
        return (boolean) $this->current();

    }

    /**
     * Magic Getter, we don't explicitly decrypt columns in the getter.
     * If you want to decrypt, call decryptColumns()
     * @param string $name column name
     * @return mixed column value
     */
    public function __get($name) {
        // relation get?
        if ($name == '_rel') {
            return $this->_rel;
        } elseif ($name == 'locale' && $this->_translatable) {
            $langName = self::getLanguageName($this->_collection);

            if (array_key_exists($langName, $this->_rel) && !is_null($this->_rel[$langName])) {
                return $this->_rel[$langName];
            } else {
                // We shouldn't break translation if the language doesn't exist.
                // return a reference back to ourselves
                // @todo log missing languages
                return $this;
            }
        } elseif (array_key_exists($name, $this->_columns)) {
            return $this->_columns[$name];
        } elseif (array_key_exists($name, $this->_auditColumns)) {
            return $this->_auditColumns[$name];
        } else {
            // otherwise bail
            $trace = debug_backtrace();
            trigger_error(
                    'Undefined property via __get(): ' . $name .
                    ' in ' . $trace[0]['file'] .
                    ' on line ' . $trace[0]['line'],
                    E_USER_NOTICE);
            return NULL;
        }

    }

    /**
     * ArrayAccess implementation, Sets a columns value
     * @param string $offset column name
     * @param mixed $value column value
     */
    public function offsetSet($offset, $value) {
        $this->__set($offset, $value);

    }

    /**
     * ArrayAccess implementation, gets a columns value
     * @param <type> $offset
     */
    public function offsetGet($offset) {
        return $this->__get($offset);

    }

    /**
     * ArrayAccess implementation, checks for the existence of a column in the model
     * @param string $offset column name
     * @return bool column exists in model
     */
    public function offsetExists($offset) {
        return array_key_exists($offset, $this->_columns);

    }

    /**
     * ArrayAccess implementation, unsets a column in the model.  Might be useful
     * for migrations.
     * @param string $offset column name to remove from the model
     */
    public function offsetUnset($offset) {
        if ($this->offsetExists($offset)) {
            unset($this->_columns[$offset]);
        }

    }

    /**
     * Pre normalises data being populated into this model
     * @param  $row
     * @return row
     */
    public function fromRowPre( $row) {
        return $row;

    }

    /**
     * Encrypts cryptable columns in place against this models cryptoFields scheme
     * @param array $columns reference to columns to be ebcrypted
     */
    public function encryptColumns(&$columns) {
        $this->_cryptColumns($columns);

    }

    /**
     * Decrypts cryptable columns in place against this models cryptoFields scheme
     * @param array $columns reference to columns to be decrypted
     */
    public function decryptColumns(&$columns) {
        $this->_cryptColumns($columns, TRUE);

    }

    /**
     * Retrives a decrypted version of the named column in this model
     * @param string $columnName name of the models column to decrypt
     * @return string decrypted column value
     */
    public function decryptColumn($columnName) {
        $dcArray = array($columnName => $this->$columnName);
        $this->_cryptColumns($dcArray, TRUE);
        return $dcArray[$columnName];

    }

    /**
     * Decrypts or encrypts columns in place.
     * @param array $columns reference to columns taking the crypt
     * @param bool $decrypt optional 'decrypt' toggle. Decrypt default is false (ie: Encrypt)
     * @return bool crypt operation completed
     */
    private function _cryptColumns(&$columns, $decrypt = FALSE) {

        $cryptCompleted = FALSE;
        if (!empty($this->_cryptoFields)) {
            $cryptoService = Bip_Registry::get(Bip_Registry::SERVICE_CRYPT);

            foreach ($columns as $columnName => $value) {
                
                if (!empty($value)) {            
                    foreach ($this->_cryptoFields as $strategy => $strategyColumns) {

                        if (in_array($columnName, $strategyColumns)) {

                            if ($decrypt) {
                                $crypted = $cryptoService->decrypt(
                                                $strategy,
                                                $value);
                            } else {
                                $crypted = $cryptoService->encrypt(
                                                $strategy,
                                                $value);
                            }

                            $columns[$columnName] = $crypted;
                            $cryptCompleted = TRUE;
                        }
                    }
                }
            }
        }
        return $cryptCompleted;

    }

    /**
     * Translates a zend DB table row into this model.  The underlying data sources
     * is a trusted source in the DAO, we don't want to validate here.
     * @param  $row
     */
    public function fromRow( $row, $decrypt = FALSE) {
        $normRows = $this->fromRowPre($row)->toArray();

        foreach ($normRows as $key => $value) {
            $this->_columns[$key] = $value;
        }

        if ($decrypt) {
            $this->decryptColumns($this->_columns);
        }

    }

    /**
     * Pre normalises data populating from this model to a table row
     * @param array $columns
     * @return array normalised columns
     */
    public function toRowPre(array $columns) {
        return $columns;

    }

    /**
     * Translates this model into a Zend DB row.
     * In this sytem, we only want to encrypt columns saving to underlying storage by default
     * @param  $row
     * @return 
     */
    public function toRow( &$row, $encrypt = FALSE) {

        $columns = $this->toRowPre($this->_columns);

        if ($encrypt) {
            $this->encryptColumns($columns);
        }

        foreach ($columns as $key => $value) {
            $row[$key] = $value;
        }

        return $row;

    }

    /**
     * Sets the proper property with this object's id. For example, when new db record is created,
     * we often want to instantly store that new id number in the newly created model.
     */
    public function setId($id) {
        $this->_columns[$this->_idField] = $id;

    }

    /**
     * Gets the proper property with this object's id. This often just returns the property that
     * corresponds to the primary key in the database.
     * @return int
     */
    public function getId() {
        return $this->_columns[$this->_idField];

    }

    public function getIdField() {
        return $this->_idField;

    }

    /**
     * Returns the uuid field for this model, if one exists
     * @return <type>
     */
    public function uuidField() {
        $uC = $this->_collection . '_uuid';
        if (array_key_exists($uc, $this->_columns)) {
            return $this->_columns[$uC];
        }
        return FALSE;

    }

    /**
     * Builds a conversion from this object to an actual array (for functions requiring an array hinted type)
     * @param bool $decrypt decrypt fields which can be decrypted.
     * @return array array representation of this model
     */
    public function toArray($decrypt = FALSE) {
        if (!$decrypt) {
            return $this->_columns;
        } else {
            $columns = $this->_columns;
            $this->decryptColumns($columns);
            return $columns;
        }

    }

    public function isEmpty($columnName) {
        return empty($this->_columns[$columnName]);

    }

}