<?php

class DocsController extends Zend_Controller_Action {

    protected $_session = NULL;

    public function init() {
        $this->_session = Zend_Registry::get('default');
        $this->view->authed = ($this->_session->authed == 1);
        $this->view->authUser = $this->_session->authUser;
        $this->view->page = 'docs';
        $this->view->domainPfx = $this->view->authed ? $this->_session->authUser['username'] : '{username}';
        $this->view->nonce = $_SESSION['_nonce'] = Bip_Utility::uuidV4();
    }

    /**
     * Loads a document partial into the document layout
     */
    public function indexAction() {
        $r = $this->getRequest();
        $namespace = $r->getParam('namespace');
        $section = $r->getParam('section');
        $subsection = $r->getParam('subsection');

        $partialTokens[] = $namespace;
        if ($section) {
            $partialTokens[] = $section;
        }

        if ($subsection) {
            $partialTokens[] = $subsection;
        }
//        var_dump($r->getParams());exit;
        $this->view->partialActive = implode('_', $partialTokens);
        $this->view->partialPath = 'docs/partials/'.implode('/', $partialTokens) . '.phtml';

        $this->view->disqus_url = ($_SERVER['SERVER_PORT'] === '80' ? 'http' : 'https').'://'.($_SERVER['SERVER_NAME']).($_SERVER['REQUEST_URI']);
        $this->view->disqus_id = md5(implode('/', $partialTokens));
    }
}