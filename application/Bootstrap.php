<?php

class Bootstrap extends Zend_Application_Bootstrap_Bootstrap {

    /**
     * Startup the custom URL router.
     */
    protected function _initRouter() {

        //
        $config = new Zend_Config_Ini(APPLICATION_PATH . '/configs/routes.ini', 'routes');
        $router = new Zend_Controller_Router_Rewrite();
        $controller = Zend_Controller_Front::getInstance();

        $router->addConfig($config, 'routes');
        Zend_Registry::set('routeConfig', $config);
        $controller->setRouter($router);
        Zend_Controller_Action_HelperBroker::addHelper(new Zend_Layout_Controller_Action_Helper_Layout);

    }

    protected function _initConfig() {
        $config = new Zend_Config($this->getOptions(), true);
        Zend_Registry::set('config', $config);

        date_default_timezone_set('America/New_York');

        return $config;
    }

    /**
     * Setup the autoload paths.
     */
    protected function _initAutoload() {
        $autoloader = Zend_Loader_Autoloader::getInstance();
        $autoloader->registerNamespace('Bip_');
    }


    protected function _initRestParser() {
        Zend_Controller_Front::getInstance()->registerPlugin(new Bip_Plugin_Controller_AcceptDetect());
    }

    protected function _initDefines() {
        $options = Zend_Registry::get('config')->toArray();

        // whitelabel persona behaves differently
        //define('WHITE_LABEL', Bip_DAO_Auth::checkAuthType() === 'auth_api');

        define('WHITE_LABEL', isset($options['isWhitelabel']) && '1' === $options['isWhitelabel']);
        define('AUTH_TYPE', $options['auth']['type']);
		define('LAYOUT', (isset($options['resources']) &&  isset($options['resources']['layout']['layout'])) ?  $options['resources']['layout']['layout'] : ''  );
        define('DEV_ENVIRONMENT', isset($options['isDev']) && '1' === $options['isDev']);
        define('APP_NAME', $options['env']['appname']);
        define('HOST_NAME', $options['env']['hostname']);
    }

    protected function _initMOTD() {
        $motds = Array(
            "Whoa Now!",
            "Follow <a href='https://twitter.com/bipioapp' target='_blank'><img src='/static/img/channels/32/color/twitter.png' />  @bipioapp</a> For The Latest News And Updates",
            "The Answer Is 42",
            "Roads? Where We're Going, We Don't Need Roads",
            "bip.io Server is Open Source!<br/><a target='_blank' href='https://github.com/bipio-server/bipio'>Fork Me On <img src='/static/img/channels/32/color/github.png'></a>",
            "Always Look On The Bright Side Of Life",
            "Graphing All The Things...",
            "Reaching The Mothership...",
            "These ARE The Droids You're Looking For!",
            "For Realtime Help <code>/join #bipio</code> on Freenode IRC",
            "Constructing Additional Pylons",
            "Hey Presto!",
            "Follow Us On <a target='_blank' href='https://vimeo.com/bipio'><img src='/static/img/channels/32/color/vimeo.png' /> Vimeo</a> For Tricks And Tips",
            "Need Help? The <a target='_blank' href='https://bip.uservoice.com/knowledgebase'>The Knowledge Base</a> Has You Covered",
            "Time not important. Only life important",
            "Thanks For Using bip.io!",
            "Assembling The Internet",
            "With Sufficient Thrust, Pigs Fly Just Fine",
            "We're In The Pipe Five By Five",
            "Do Or Do Not, There Is No Try",
            "Reticulating Splines",
            "Warewolves Not Swearwolves!",
            "Thinking...",
            "When you're feeling under pressure, do something different.<br/>Roll up your sleeves, or eat an orange"
        );

        define('MOTD', WHITE_LABEL || 'bip.io' !== APP_NAME ? 'Thinking...' : $motds[ array_rand($motds)]);
    }
}
