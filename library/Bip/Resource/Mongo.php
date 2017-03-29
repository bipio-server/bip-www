<?php
class Bip_Resource_Mongo  extends Zend_Application_Resource_ResourceAbstract
{
    private $_db = null;
    
    /**
     * Definable Mongo options.
     *
     * @var array
     */
    protected $_options = array(
        'hostname'     => '127.0.0.1',
        'port'         => '27017',
        'username'     => null,
        'password'     => null,
        'databasename' => null,
        'connect'      => true
    );
    /**
     * Initalizes a Mongo instance.
     *
     * @return Mongo
     * @throws Zend_Exception
     */
    public function init()
    {
        $options = $this->getOptions();     
        if (null !== $options['databasename'] &&
            'production' === APPLICATION_ENV) {
            
            $userPreamble	= '';
            if (null !== $options['username'] && null !== $options['password']) {
       	        $userPreamble = sprintf('%s:%s@', $options['username'], $options['password']);
      	    }

            $mongoDsn = sprintf('mongodb://' . $userPreamble . '%s:%s/%s',
                $options['hostname'],
                $options['port'],
                $options['databasename']
            );
            
        } elseif ('production' !== APPLICATION_ENV) {         
            $mongoDsn = sprintf('mongodb://%s:%s/%s',
                $options['hostname'],
                $options['port'],
                $options['databasename']
            );
        } else {
            $exceptionMessage = sprintf(
                'Recource %s is not configured correctly',
                __CLASS__
            );
            throw new Zend_Exception($exceptionMessage);
        }

        try {
            $mongo = new Mongo($mongoDsn, array('connect' => true));

            $mongo->connect();   

            $this->_db = $mongo->selectDb($options['databasename']);
            return $this->_db;
        } catch (MongoConnectionException $e) {
            throw new Zend_Exception($e->getMessage());
        }
    }
    
    public function getDb() {
        var_dump($this->_db);
        return $this->_db;
    }
    
}
