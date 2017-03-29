<?php
/**
 *
 * Handles email verification
 *
 */
class EmitterController extends Zend_Controller_Action
{
    protected $_session = NULL;

    public function init()
    {
        $this->_session = Zend_Registry::get('default');
        $this->view->authed = ($this->_session->authed == 1);
        $this->view->authUser = $this->_session->authUser;
        $this->_authDAO = new Bip_DAO_Auth();
    }

    public function emailverifyAction() {
        $mode = $this->getRequest()->getParam('mode');
        $this->view->mode = $mode;
    }

    public function oauthcbAction() {
        $this->_helper->layout()->disableLayout();        
        $this->view->status = $this->getRequest()->getParam('status');
        $this->view->provider = $this->getRequest()->getParam('provider');
    }
}
